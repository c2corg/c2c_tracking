import dayjs from 'dayjs';

import { database as db } from '../db';
import { IOError } from '../errors';

import type { User } from './user';

type UserRow = {
  c2c_id: number;
  strava_id: number | undefined | null;
  strava_access_token: string | undefined | null;
  strava_expires_at: Date | undefined | null;
  strava_refresh_token: string | undefined | null;
  suunto_username: string | undefined | null;
  suunto_access_token: string | undefined | null;
  suunto_expires_at: Date | undefined | null;
  suunto_refresh_token: string | undefined | null;
  garmin_token: string | undefined | null;
  garmin_token_secret: string | undefined | null;
};

export class UserRepository {
  readonly #TABLE = 'users';

  async findById(c2cId: number): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn(this.#TABLE).where({ c2c_id: c2cId }).first();

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
      const row = await conn(this.#TABLE).where({ strava_id: stravaId }).first();
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
      const row = await conn(this.#TABLE).where({ suunto_username: username }).first();
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
      const row = await conn(this.#TABLE).where({ garmin_token: token }).first();
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
    await conn(this.#TABLE).insert(this.userToRecord(user));
    return user;
  }

  async update(user: User): Promise<User> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn(this.#TABLE).where({ c2c_id: user.c2cId }).update<UserRow>(this.userToRecord(user));
    return user;
  }

  private rowToUser(row: UserRow): User {
    return {
      c2cId: row.c2c_id,
      ...(row.strava_id &&
        row.strava_access_token &&
        row.strava_expires_at &&
        row.strava_refresh_token && {
          strava: {
            id: row.strava_id,
            accessToken: row.strava_access_token,
            expiresAt: dayjs(row.strava_expires_at).unix(),
            refreshToken: row.strava_refresh_token,
          },
        }),
      ...(row.suunto_username &&
        row.suunto_access_token &&
        row.suunto_expires_at &&
        row.suunto_refresh_token && {
          suunto: {
            username: row.suunto_username,
            accessToken: row.suunto_access_token,
            expiresAt: dayjs(row.suunto_expires_at).unix(),
            refreshToken: row.suunto_refresh_token,
          },
        }),
      ...(row.garmin_token &&
        row.garmin_token_secret && {
          garmin: {
            token: row.garmin_token,
            tokenSecret: row.garmin_token_secret,
          },
        }),
    };
  }

  private userToRecord(user: User): UserRow {
    const strava:
      | Pick<UserRow, 'strava_access_token' | 'strava_expires_at' | 'strava_id' | 'strava_refresh_token'>
      | undefined = user.strava
      ? {
          strava_id: user.strava.id,
          strava_access_token: user.strava.accessToken,
          strava_expires_at: user.strava.expiresAt ? dayjs.unix(user.strava.expiresAt).toDate() : undefined,
          strava_refresh_token: user.strava.refreshToken,
        }
      : {
          strava_id: null,
          strava_access_token: null,
          strava_expires_at: null,
          strava_refresh_token: null,
        };
    const suunto:
      | Pick<UserRow, 'suunto_access_token' | 'suunto_expires_at' | 'suunto_refresh_token' | 'suunto_username'>
      | undefined = user.suunto
      ? {
          suunto_username: user.suunto.username,
          suunto_access_token: user.suunto.accessToken,
          suunto_expires_at: user.suunto.expiresAt ? dayjs.unix(user.suunto.expiresAt).toDate() : undefined,
          suunto_refresh_token: user.suunto.refreshToken,
        }
      : {
          suunto_username: null,
          suunto_access_token: null,
          suunto_expires_at: null,
          suunto_refresh_token: null,
        };
    const garmin: Pick<UserRow, 'garmin_token' | 'garmin_token_secret'> | undefined = user.garmin
      ? {
          garmin_token: user.garmin.token,
          garmin_token_secret: user.garmin.tokenSecret,
        }
      : {
          garmin_token: null,
          garmin_token_secret: null,
        };
    return {
      c2c_id: user.c2cId,
      ...(strava && { ...strava }),
      ...(suunto && { ...suunto }),
      ...(garmin && { ...garmin }),
    };
  }
}

export const userRepository = new UserRepository();
