import dayjs from 'dayjs';

import { database as db } from '../db';
import { IOError } from '../errors';

import { User } from './user';

export class UserRepository {
  readonly #TABLE = 'users';

  public async findById(c2cId: number): Promise<User | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const row = await conn
        ?.table(this.#TABLE)
        .where({ c2c_id: c2cId })
        .first();

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
      c2cId: row.c2c_id,
      strava: {
        id: row.strava_id,
        access_token: row.acess_token,
        expires_at: row.expires_at,
        refresh_token: row.refresh_token,
      },
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
    }
    return data;
  }
}

export const userRepository = new UserRepository();
