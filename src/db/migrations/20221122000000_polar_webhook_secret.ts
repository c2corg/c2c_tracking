import type { Knex } from 'knex';

const schema = process.env['DB_SCHEMA'] || 'public';

export function up(db: Knex): Knex.SchemaBuilder {
  return db.schema.withSchema(schema).alterTable('polar', (table) => {
    table.string('webhook_secret', 256).alter({ alterNullable: false, alterType: true });
  });
}

export function down(db: Knex): Knex.SchemaBuilder {
  // nothing to do
  return db.schema.withSchema(schema);
}
