import path from 'node:path';

import knex, { type Knex } from 'knex';

void (async (): Promise<void> => {
  let connection: Knex | undefined;
  try {
    connection = knex({
      client: 'pg',
      connection: {
        host: process.env['DB_HOST'] || 'localhost',
        port: Number.parseInt(process.env['DB_PORT'] || '5432', 10),
        user: process.env['DB_USER'] || 'postgres',
        password: process.env['DB_PASSORD'] || 'postgres',
        database: process.env['DB_NAME'] || 'postgres',
      },
      debug: false,
    });

    await connection.schema.dropSchemaIfExists('public', true);
    await connection.schema.createSchema('public');

    await connection.migrate.latest({ directory: path.resolve(__dirname, '../../src/db/migrations') });

    await connection('users').insert({ c2c_id: 1 });
    await connection('users').insert({ c2c_id: 2 });
    console.log('DB initialized 🚀');
  } catch (error: unknown) {
    console.error(error);
  } finally {
    await connection?.destroy();
  }
})();
