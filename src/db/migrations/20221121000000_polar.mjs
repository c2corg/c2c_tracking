const schema = process.env['DB_SCHEMA'] || 'public';

/**
 * @param {import('knex').Knex} db
 * @returns {import('knex').Knex.SchemaBuilder}
 */
export function up(db) {
  return db.schema
    .withSchema(schema)
    .alterTable('users', (table) => {
      table.bigInteger('polar_id').unique();
      table.string('polar_token', 256);
    })
    .createTable('polar', (table) => {
      table.increments('id').primary();
      table.string('webhook_secret', 50).notNullable();
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
      table.dropColumns('polar_id', 'polar_token');
    })
    .dropTable('polar');
}
