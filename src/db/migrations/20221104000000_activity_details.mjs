const schema = process.env['DB_SCHEMA'] || 'public';

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function up(db) {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.integer('length').nullable();
    table.integer('duration').nullable();
    table.integer('height_diff_up').nullable();
  });
}

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function down(db) {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.dropColumns('length', 'duration', 'height_diff_up');
  });
}
