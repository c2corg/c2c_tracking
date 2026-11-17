import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.text('strava_id').nullable().alter();
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.integer('strava_id').nullable().alter();
  });
}
