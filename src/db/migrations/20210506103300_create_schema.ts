import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('users', (table) => {
    table.integer('c2c_id').primary();
    table.integer('strava_id').notNullable().unique();
    table.string('strava_access_token', 256);
    table.timestamp('strava_expires_at');
    table.string('strava_refresh_token', 256);
  });

  await db.schema.createTable('activities', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unsigned().references('c2c_id').inTable('users').onDelete('CASCADE');
    table.string('vendor').notNullable();
    table.string('vendor_id').notNullable();
    table.string('name').notNullable();
    table.string('type');
    table.string('date').notNullable();
  });

  await db.schema.createTable('strava', (table) => {
    table.increments('id').primary();
    table.integer('subscription_id');
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.dropTable('users').dropTable('activities').dropTable('strava');
}
