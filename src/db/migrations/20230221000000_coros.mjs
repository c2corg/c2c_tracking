const schema = process.env['DB_SCHEMA'] || 'public';

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function up(db) {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.string('coros_id', 256).unique();
    table.string('coros_access_token', 256);
    table.timestamp('coros_expires_at');
    table.string('coros_refresh_token', 256);
  });
}

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function down(db) {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.dropColumns('coros_id', 'coros_access_token', 'coros_expires_at', 'coros_refresh_token');
  });
}
