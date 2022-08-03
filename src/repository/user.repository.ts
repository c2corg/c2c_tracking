import dayjs from 'dayjs';

import { database as db } from '../db';
import { IOError } from '../errors';

import type { User } from './user';

export class UserRepository {
  readonly #TABLE = 'users';

  async findById(c2cId: number): Promise<User | undefined> {
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

  async findByStravaId(stravaId: number): Promise<User | undefined> {
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

  async findBySuuntoUsername(username: string): Promise<User | undefined> {
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

  async findByGarminToken(token: string): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn?.table(this.#TABLE).where({ garmin_token: token }).first();
      if (!row) {
        return undefined;
      }
      return this.rowToUser(row);
    } catch (err) {
      return undefined;
    }
  }

  async insert(user: User): Promise<User> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.table(this.#TABLE).insert(this.userToRecord(user));
    return user;
  }

  async update(user: User): Promise<User> {
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
          accessToken: row.strava_access_token,
          expiresAt: Math.floor(row.strava_expires_at / 1000),
          refreshToken: row.strava_refresh_token,
        },
      }),
      ...(row.suunto_username && {
        suunto: {
          username: row.suunto_username,
          accessToken: row.suunto_access_token,
          expiresAt: Math.floor(row.suunto_expires_at / 1000),
          refreshToken: row.suunto_refresh_token,
        },
      }),
      ...(row.garmin_token && {
        garmin: {
          token: row.garmin_token,
          tokenSecret: row.garmin_token_secret,
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
        strava_access_token: user.strava.accessToken,
        strava_expires_at: user.strava.expiresAt ? dayjs.unix(user.strava.expiresAt).toISOString() : undefined,
        strava_refresh_token: user.strava.refreshToken,
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
        suunto_access_token: user.suunto.accessToken,
        suunto_expires_at: user.suunto.expiresAt ? dayjs.unix(user.suunto.expiresAt).toISOString() : undefined,
        suunto_refresh_token: user.suunto.refreshToken,
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
    if (user.garmin) {
      data = {
        ...data,
        garmin_token: user.garmin.token,
        garmin_token_secret: user.garmin.tokenSecret,
      };
    } else {
      data = {
        ...data,
        garmin_token: null,
        garmin_token_secret: null,
      };
    }
    return data;
  }
}

export const userRepository = new UserRepository();
