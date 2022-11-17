import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema
    .withSchema(schema)
    .createTable('users', (table) => {
      table.integer('c2c_id').primary();
      table.integer('strava_id').unique();
      table.string('strava_access_token', 4096);
      table.timestamp('strava_expires_at');
      table.string('strava_refresh_token', 4096);
      table.string('suunto_username').unique();
      table.string('suunto_access_token', 4096);
      table.timestamp('suunto_expires_at');
      table.string('suunto_refresh_token', 4096);
    })
    .createTable('activities', (table) => {
      table.increments('id').primary();
      table
        .integer('user_id')
        .notNullable()
        .unsigned()
        .references('c2c_id')
        .inTable(`${schema}.users`)
        .onDelete('CASCADE');
      table.string('vendor').notNullable();
      table.string('vendor_id').notNullable();
      table.string('name');
      table.string('type').notNullable();
      table.string('date').notNullable();
    })
    .createTable('strava', (table) => {
      table.increments('id').primary();
      table.integer('subscription_id').notNullable();
    });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).dropTable('users').dropTable('activities').dropTable('strava');
}
