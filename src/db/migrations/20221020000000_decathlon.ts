import type { Knex } from 'knex';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.alterTable('users', (table) => {
    table.string('decathlon_id');
    table.string('decathlon_access_token', 4096);
    table.timestamp('decathlon_expires_at');
    table.string('decathlon_refresh_token', 4096);
    table.string('decathlon_webhook_id');
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  return db.schema.alterTable('users', (table) => {
    table.dropColumns(
      'decathlon_id',
      'decathlon_access_token',
      'decathlon_expires_at',
      'decathlon_refresh_token',
      'decathlon_webhook_id',
    );
  });
}
