import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.string('coros_id', 256).unique();
    table.string('coros_access_token', 256);
    table.timestamp('coros_expires_at');
    table.string('coros_refresh_token', 256);
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.dropColumns('coros_id', 'coros_access_token', 'coros_expires_at', 'coros_refresh_token');
  });
}
