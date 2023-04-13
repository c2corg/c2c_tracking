import path from 'node:path';

import { retry, type AsyncResultCallback } from 'async';
import * as knex from 'knex';

import config from '../config.js';

export type Configuration = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
  debug: boolean;
};

export class Database {
  private config: Configuration;
  private connection: knex.Knex | undefined;
  private retryDbConnectionPromise: Promise<knex.Knex | undefined> | undefined;

  constructor(config: Configuration) {
    this.config = config;
  }

  public async getConnection(): Promise<knex.Knex | undefined> {
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
      directory: path.resolve(__dirname, './migrations'),
    });
  }

  private async createConnection(): Promise<knex.Knex> {
    const dbConfig: knex.Knex.Config = {
      client: 'pg',
      connection: {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        ...(this.config.ssl && { ssl: { rejectUnauthorized: false } }),
      },
      debug: this.config.debug,
      migrations: {
        tableName: 'migrations',
        schemaName: config.get('db.schema'),
      },
    };

    const db = knex.knex(dbConfig);

    // Test database connectivity
    await db.raw('select 1');

    return db;
  }

  private retryDbConnection(): Promise<knex.Knex | undefined> {
    if (this.retryDbConnectionPromise instanceof Promise) {
      return this.retryDbConnectionPromise;
    }

    const methodToRetry = (cb: AsyncResultCallback<knex.Knex, Error>): void => {
      this.createConnection()
        .then((db: knex.Knex) => {
          cb(undefined, db);
        })
        .catch((err: Error) => {
          cb(err, undefined);
        });
    };

    this.retryDbConnectionPromise = new Promise<knex.Knex | undefined>((resolve, reject) => {
      retry({ times: 3, interval: 1000 }, methodToRetry, (err: Error | null | undefined, db: knex.Knex | undefined) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }

        this.retryDbConnectionPromise = undefined;
      });
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
  debug: false, // config.get('env') !== 'production'
});
