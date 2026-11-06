import { readdir } from 'node:fs/promises';
import path from 'node:path';

import knex, { type Knex } from 'knex';

const migrationsDirectory = path.resolve('src/db/migrations'); // relative to the Vitest root;

// knex would require() the TypeScript migrations itself: load them through Vitest instead
const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: async () => (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.ts')).sort(),
  getMigrationName: (migration) => migration,
  getMigration: async (migration) => (await import(path.join(migrationsDirectory, migration))) as Knex.Migration,
};

// Runs once before the psql tests: recreate the schema, apply the migrations and add the users the tests rely on
export default async function setup(): Promise<void> {
  const connection = knex({
    client: 'pg',
    connection: {
      host: process.env['DB_HOST'] || 'localhost',
      port: Number.parseInt(process.env['DB_PORT'] || '5432', 10),
      user: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'] || 'postgres',
      database: process.env['DB_NAME'] || 'postgres',
    },
  });
  try {
    await connection.schema.dropSchemaIfExists('public', true);
    await connection.schema.createSchema('public');
    await connection.migrate.latest({ migrationSource });
    await connection('users').insert([{ c2c_id: 1 }, { c2c_id: 2 }]);
  } finally {
    await connection.destroy();
  }
}
