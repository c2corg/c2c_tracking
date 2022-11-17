import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.integer('length').nullable();
    table.integer('duration').nullable();
    table.integer('height_diff_up').nullable();
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.dropColumns('length', 'duration', 'height_diff_up');
  });
}
