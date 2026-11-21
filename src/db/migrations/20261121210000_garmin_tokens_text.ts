import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

// Garmin OAuth 2 tokens, once encrypted (`v1:` + base64 of iv, tag and ciphertext), exceed 1024 characters
export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.text('garmin_access_token').nullable().alter();
    table.text('garmin_refresh_token').nullable().alter();
  });
}

// fails once a longer token is stored
export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.string('garmin_access_token', 1024).nullable().alter();
    table.string('garmin_refresh_token', 1024).nullable().alter();
  });
}
