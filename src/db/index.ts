import { readFileSync } from 'fs';
import path from 'path';

import type { Knex } from 'knex';
import knex from 'knex';

import config from '../config.ts';
import { retry } from '../helpers/retry.ts';

export type Configuration = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  sslCaFile: string;
  debug: boolean;
};

/**
 * TLS options of the connection: none without SSL. With SSL, the server certificate is only checked (chain and host
 * name) if asked, against the given authority (a private one) or the system ones.
 */
export function sslOptions(
  dbConfig: Pick<Configuration, 'ssl' | 'sslRejectUnauthorized' | 'sslCaFile'>,
): { rejectUnauthorized: boolean; ca?: Buffer } | undefined {
  if (!dbConfig.ssl) {
    return undefined;
  }

  return {
    rejectUnauthorized: dbConfig.sslRejectUnauthorized,
    // path from the configuration, not from a request
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    ...(dbConfig.sslCaFile && { ca: readFileSync(dbConfig.sslCaFile) }),
  };
}

export class Database {
  private config: Configuration;
  private connection: Knex | undefined;
  private retryDbConnectionPromise: Promise<Knex | undefined> | undefined;

  constructor(config: Configuration) {
    this.config = config;
  }

  public async getConnection(): Promise<Knex | undefined> {
    if (!this.connection) {
      this.connection = await this.retryDbConnection();
    }

    return this.connection;
  }

  public async closeDatabase(): Promise<void> {
    if (this.connection) {
      await this.connection.destroy();
      this.connection = undefined;
    }
  }

  public async schemaMigration(): Promise<void> {
    const connection = await this.getConnection();
    if (!connection) {
      return;
    }

    await connection.migrate.latest({
      directory: path.resolve(import.meta.dirname, './migrations'),
    });
  }

  private async createConnection(): Promise<Knex> {
    const dbConfig: Knex.Config = {
      client: 'pg',
      connection: {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        ssl: sslOptions(this.config),
      },
      debug: this.config.debug,
      migrations: {
        tableName: 'migrations',
        schemaName: config.get('db.schema'),
      },
    };

    const db = knex(dbConfig);

    // Test database connectivity, without leaking the pool of a failed attempt
    try {
      await db.raw('select 1');
    } catch (error) {
      await db.destroy();
      throw error;
    }

    return db;
  }

  private retryDbConnection(): Promise<Knex | undefined> {
    if (this.retryDbConnectionPromise instanceof Promise) {
      return this.retryDbConnectionPromise;
    }

    this.retryDbConnectionPromise = retry(() => this.createConnection(), { times: 3, interval: 1000 }).finally(() => {
      this.retryDbConnectionPromise = undefined;
    });

    return this.retryDbConnectionPromise;
  }
}

export const database = new Database({
  database: config.get('db.name'),
  host: config.get('db.host'),
  port: config.get('db.port'),
  user: config.get('db.user'),
  password: config.get('db.password'),
  ssl: config.get('db.ssl'),
  sslRejectUnauthorized: config.get('db.sslRejectUnauthorized'),
  sslCaFile: config.get('db.sslCaFile'),
  debug: false, // config.get('env') !== 'production'
});
