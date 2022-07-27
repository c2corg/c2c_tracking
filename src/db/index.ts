import path from 'path';
import { fileURLToPath } from 'url';

import { AsyncResultCallback, retry } from 'async';
import knex, { Knex } from 'knex';

import { checkEnvvars } from '../helpers/envar';

export type Configuration = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  debug: boolean;
};

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export class Database {
  private config: Configuration;
  private connection: Knex | undefined;
  private retryDbConnectionPromise: Promise<Knex | undefined> | undefined;

  constructor(config: Configuration) {
    this.config = config;
    checkEnvvars('DB_NAME', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD');
  }

  async getConnection(): Promise<Knex | undefined> {
    if (!this.connection) {
      this.connection = await this.retryDbConnection();
    }

    return this.connection;
  }

  async getTransaction(): Promise<Knex.Transaction> {
    const connection = await this.getConnection();

    return new Promise<Knex.Transaction>((resolve, reject) => {
      if (!connection) {
        reject('No DB connection');
        return;
      }
      try {
        connection.transaction((trx: Knex.Transaction) => {
          resolve(trx);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async closeDatabase(): Promise<void> {
    if (this.connection) {
      await this.connection.destroy();
      this.connection = undefined;
    }
  }

  async schemaMigration(): Promise<void> {
    const connection = await this.getConnection();
    if (!connection) {
      return;
    }

    await connection.migrate.latest({
      directory: path.resolve(__dirname, './migrations'),
    });
  }

  private async createConnection(): Promise<Knex> {
    const config: Knex.Config = {
      client: 'pg',
      connection: {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
      },
      debug: this.config.debug,
      migrations: {
        tableName: 'migrations',
      },
    };

    const db = knex(config);

    // Test database connectivity
    await db.raw('select 1');

    return db;
  }

  private retryDbConnection(): Promise<Knex | undefined> {
    if (this.retryDbConnectionPromise instanceof Promise) {
      return this.retryDbConnectionPromise;
    }

    const methodToRetry = (cb: AsyncResultCallback<Knex, Error>): void => {
      this.createConnection()
        .then((db: Knex) => {
          cb(undefined, db);
        })
        .catch((err: Error) => {
          cb(err, undefined);
        });
    };

    this.retryDbConnectionPromise = new Promise<Knex | undefined>((resolve, reject) => {
      retry({ times: 3, interval: 1000 }, methodToRetry, (err: Error | null | undefined, db: Knex | undefined) => {
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
  database: process.env['DB_NAME'] ?? 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT']) ?? 5432,
  user: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  debug: process.env['ENV'] !== 'production',
});
