const schema = process.env['DB_SCHEMA'] || 'public';

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function up(db) {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.string('miniature', 28);
  });
}

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function down(db) {
  return db.schema.withSchema(schema).alterTable('activities', (table) => {
    table.dropColumn('miniature');
  });
}
