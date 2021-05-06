import { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('users', (table) => {
    table.increments('c2c_id').primary();
    table.integer('strava_id').notNullable().unique();
    table.string('access_token', 256);
    table.timestamp('expires_at');
    table.string('refresh_token', 256);
  });
  await db.schema.createTable('activities', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unsigned().references('c2c_id').inTable('users');
    table.string('name').notNullable();
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.dropTable('task').dropTable('user');
}
