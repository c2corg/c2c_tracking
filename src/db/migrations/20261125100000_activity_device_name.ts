import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.text('device_name').nullable();
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.dropColumn('device_name');
  });
}
