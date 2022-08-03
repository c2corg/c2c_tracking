import type { Knex } from 'knex';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema
    .alterTable('users', (table) => {
      table.string('garmin_token').unique();
      table.string('garmin_token_secret').unique();
    })
    .alterTable('activities', (table) => {
      table.json('geojson');
    });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema
    .alterTable('users', (table) => {
      table.dropColumns('garmin_token', 'garmin_token_secret');
    })
    .alterTable('activities', (table) => {
      table.dropColumn('activities');
    });
}
