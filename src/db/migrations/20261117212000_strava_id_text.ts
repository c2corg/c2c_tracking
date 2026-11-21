import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.text('strava_id').nullable().alter();
  });
}

// fails once an ID above 2^31 - 1 is stored: such a value no longer fits an integer column
export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.integer('strava_id').nullable().alter();
  });
}
