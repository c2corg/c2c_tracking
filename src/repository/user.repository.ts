import dayjs from 'dayjs';

import { database as db } from '../db';
import { IOError } from '../errors';

import type { User } from './user';

export class UserRepository {
  readonly #TABLE = 'users';

  public async findById(c2cId: number): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn?.table(this.#TABLE).where({ c2c_id: c2cId }).first();

      if (!row) {
        return undefined;
      }

      return this.rowToUser(row);
    } catch (err) {
      return undefined;
    }
  }

  public async findByStravaId(stravaId: number): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn?.table(this.#TABLE).where({ strava_id: stravaId }).first();
      if (!row) {
        return undefined;
      }
      return this.rowToUser(row);
    } catch (err) {
      return undefined;
    }
  }

  public async findBySuuntoUsername(username: string): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn?.table(this.#TABLE).where({ suunto_username: username }).first();
      if (!row) {
        return undefined;
      }
      return this.rowToUser(row);
    } catch (err) {
      return undefined;
    }
  }

  public async insert(user: User): Promise<User> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.table(this.#TABLE).insert(this.userToRecord(user));
    return user;
  }

  public async update(user: User): Promise<User> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.table(this.#TABLE).update(this.userToRecord(user));
    return user;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToUser(row: any): User {
    return {
      ...{ c2cId: row.c2c_id },
      ...(row.strava_id && {
        strava: {
          id: row.strava_id,
          access_token: row.strava_access_token,
          expires_at: Math.floor(row.strava_expires_at / 1000),
          refresh_token: row.strava_refresh_token,
        },
      }),
      ...(row.suunto_username && {
        suunto: {
          username: row.suunto_username,
          access_token: row.suunto_access_token,
          expires_at: Math.floor(row.suunto_expires_at / 1000),
          refresh_token: row.suunto_refresh_token,
        },
      }),
    };
  }

  private userToRecord(user: User): Record<string, unknown> {
    let data: Record<string, unknown> = {};
    data = { ...data, c2c_id: user.c2cId };
    if (user.strava) {
      data = {
        ...data,
        strava_id: user.strava.id,
        strava_access_token: user.strava.access_token,
        strava_expires_at: user.strava.expires_at ? dayjs.unix(user.strava.expires_at).toISOString() : undefined,
        strava_refresh_token: user.strava.refresh_token,
      };
    } else {
      data = {
        ...data,
        strava_id: null,
        strava_access_token: null,
        strava_expires_at: null,
        strava_refresh_token: null,
      };
    }
    if (user.suunto) {
      data = {
        ...data,
        suunto_username: user.suunto.username,
        suunto_access_token: user.suunto.access_token,
        suunto_expires_at: user.suunto.expires_at ? dayjs.unix(user.suunto.expires_at).toISOString() : undefined,
        suunto_refresh_token: user.suunto.refresh_token,
      };
    } else {
      data = {
        ...data,
        suunto_username: null,
        suunto_access_token: null,
        suunto_expires_at: null,
        suunto_refresh_token: null,
      };
    }
    return data;
  }
}

export const userRepository = new UserRepository();
