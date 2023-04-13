const schema = process.env['DB_SCHEMA'] || 'public';

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function up(db) {
  return db.schema
    .withSchema(schema)
    .alterTable('users', (table) => {
      table.string('garmin_token').unique();
      table.string('garmin_token_secret').unique();
    })
    .alterTable('activities', (table) => {
      table.json('geojson');
    });
}

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function down(db) {
  return db.schema
    .withSchema(schema)
    .alterTable('users', (table) => {
      table.dropColumns('garmin_token', 'garmin_token_secret');
    })
    .alterTable('activities', (table) => {
      table.dropColumn('activities');
    });
}
