import dayjs from 'dayjs';

import config from '../config';
import { database as db } from '../db';
import { IOError } from '../errors';
import { decrypt, encrypt } from '../helpers/utils';

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
  decathlon_id: string | undefined | null;
  decathlon_access_token: string | undefined | null;
  decathlon_expires_at: Date | undefined | null;
  decathlon_refresh_token: string | undefined | null;
  decathlon_webhook_id: string | undefined | null;
  polar_id: number | undefined | null;
  polar_token: string | undefined | null;
};

export class UserRepository {
  readonly #TABLE = config.get('db.schema') + '.users';

  public async findById(c2cId: number): Promise<User | undefined> {
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

  public async findByStravaId(stravaId: number): Promise<User | undefined> {
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

  public async findBySuuntoUsername(username: string): Promise<User | undefined> {
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

  public async findByGarminToken(token: string): Promise<User | undefined> {
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

  public async findByDecathlonId(decathlonId: string): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn(this.#TABLE).where({ decathlon_id: decathlonId }).first();
      if (!row) {
        return undefined;
      }
      return this.rowToUser(row);
    } catch (err) {
      return undefined;
    }
  }

  public async findByPolarId(polarId: number): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn(this.#TABLE).where({ polar_id: polarId }).first();
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
    await conn(this.#TABLE).insert(this.userToRecord(user));
    return user;
  }

  public async update(user: User): Promise<User> {
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
            accessToken: decrypt(row.strava_access_token),
            expiresAt: dayjs(row.strava_expires_at).unix(),
            refreshToken: decrypt(row.strava_refresh_token),
          },
        }),
      ...(row.suunto_username &&
        row.suunto_access_token &&
        row.suunto_expires_at &&
        row.suunto_refresh_token && {
          suunto: {
            username: row.suunto_username,
            accessToken: decrypt(row.suunto_access_token),
            expiresAt: dayjs(row.suunto_expires_at).unix(),
            refreshToken: decrypt(row.suunto_refresh_token),
          },
        }),
      ...(row.garmin_token &&
        row.garmin_token_secret && {
          garmin: {
            token: row.garmin_token,
            tokenSecret: decrypt(row.garmin_token_secret),
          },
        }),
      ...(row.decathlon_id &&
        row.decathlon_access_token &&
        row.decathlon_expires_at &&
        row.decathlon_refresh_token &&
        row.decathlon_webhook_id && {
          decathlon: {
            id: row.decathlon_id,
            accessToken: decrypt(row.decathlon_access_token),
            expiresAt: dayjs(row.decathlon_expires_at).unix(),
            refreshToken: decrypt(row.decathlon_refresh_token),
            webhookId: row.decathlon_webhook_id,
          },
        }),
      ...(row.polar_id &&
        row.polar_token && {
          polar: {
            id: row.polar_id,
            token: decrypt(row.polar_token),
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
          strava_access_token: user.strava.accessToken ? encrypt(user.strava.accessToken) : null,
          strava_expires_at: user.strava.expiresAt ? dayjs.unix(user.strava.expiresAt).toDate() : null,
          strava_refresh_token: user.strava.refreshToken ? encrypt(user.strava.refreshToken) : null,
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
          suunto_access_token: user.suunto.accessToken ? encrypt(user.suunto.accessToken) : null,
          suunto_expires_at: user.suunto.expiresAt ? dayjs.unix(user.suunto.expiresAt).toDate() : null,
          suunto_refresh_token: user.suunto.refreshToken ? encrypt(user.suunto.refreshToken) : null,
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
          garmin_token_secret: encrypt(user.garmin.tokenSecret),
        }
      : {
          garmin_token: null,
          garmin_token_secret: null,
        };
    const decathlon:
      | Pick<
          UserRow,
          | 'decathlon_id'
          | 'decathlon_access_token'
          | 'decathlon_expires_at'
          | 'decathlon_refresh_token'
          | 'decathlon_webhook_id'
        >
      | undefined = user.decathlon
      ? {
          decathlon_id: user.decathlon.id,
          decathlon_access_token: user.decathlon.accessToken ? encrypt(user.decathlon.accessToken) : null,
          decathlon_expires_at: user.decathlon.expiresAt ? dayjs.unix(user.decathlon.expiresAt).toDate() : null,
          decathlon_refresh_token: user.decathlon.refreshToken ? encrypt(user.decathlon.refreshToken) : null,
          decathlon_webhook_id: user.decathlon.webhookId,
        }
      : {
          decathlon_id: null,
          decathlon_access_token: null,
          decathlon_expires_at: null,
          decathlon_refresh_token: null,
          decathlon_webhook_id: null,
        };
    const polar: Pick<UserRow, 'polar_id' | 'polar_token'> | undefined = user.polar
      ? {
          polar_id: user.polar.id,
          polar_token: user.polar.token ? encrypt(user.polar.token) : null,
        }
      : {
          polar_id: null,
          polar_token: null,
        };
    return {
      c2c_id: user.c2cId,
      ...(strava && { ...strava }),
      ...(suunto && { ...suunto }),
      ...(garmin && { ...garmin }),
      ...(decathlon && { ...decathlon }),
      ...(polar && { ...polar }),
    };
  }
}

export const userRepository = new UserRepository();
