import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

/*
 * Garmin OAuth 2: users are identified by their Garmin API user id (the OAuth 1 token is no longer sent in the
 * webhooks). The OAuth 1 columns (garmin_token, garmin_token_secret) are kept: they are still needed to migrate
 * the users who linked their account before the switch, and to recognize legacy webhooks meanwhile.
 */
export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.string('garmin_user_id', 256).unique();
    table.string('garmin_access_token', 1024);
    table.timestamp('garmin_expires_at');
    table.string('garmin_refresh_token', 1024);
    table.timestamp('garmin_refresh_expires_at');
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('users', (table) => {
    table.dropColumns(
      'garmin_user_id',
      'garmin_access_token',
      'garmin_expires_at',
      'garmin_refresh_token',
      'garmin_refresh_expires_at',
    );
  });
}
