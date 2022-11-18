import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema
    .withSchema(schema)
    .alterTable('users', (table) => {
      table.bigInteger('polar_id').unique();
      table.string('polar_token', 256);
    })
    .createTable('polar', (table) => {
      table.increments('id').primary();
      table.string('webhook_secret', 50).notNullable();
    });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema
    .withSchema(schema)
    .alterTable('users', (table) => {
      table.dropColumns('polar_id', 'polar_token');
    })
    .dropTable('polar');
}
