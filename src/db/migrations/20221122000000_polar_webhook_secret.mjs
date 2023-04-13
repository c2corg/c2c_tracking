const schema = process.env['DB_SCHEMA'] || 'public';

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function up(db) {
  return db.schema.withSchema(schema).alterTable('polar', (table) => {
    table.string('webhook_secret', 256).alter({ alterNullable: false, alterType: true });
  });
}

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function down(db) {
  // nothing to do
  return db.schema.withSchema(schema);
}
