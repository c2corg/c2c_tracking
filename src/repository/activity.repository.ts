import { database as db } from '../db';
import { IOError, NotFoundError } from '../errors';

import type { Activity } from './activity';

class ActivityRepository {
  readonly #TABLE = 'activities';

  async findByUser(userId: number): Promise<Activity[]> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const rows = await conn?.table(this.#TABLE).where({ user_id: userId }).orderBy('date', 'desc');

      if (!rows) {
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows.map((row: any) => this.rowToActivity(row));
    } catch (err) {
      return [];
    }
  }

  async findByUserAndId(userId: number, activityId: number): Promise<Activity | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const rows = await conn?.table(this.#TABLE).where({ user_id: userId, id: activityId });

      if (!rows) {
        return undefined;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.rowToActivity(rows[0]);
    } catch (err) {
      return undefined;
    }
  }

  async insert(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    const result = await conn.table(this.#TABLE).insert(this.activityToRecord(activity));
    return { ...activity, id: result[0]! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async update(activity: Activity): Promise<Activity> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.table(this.#TABLE).where({ id: activity.id }).update(this.activityToRecord(activity));
    return activity;
  }

  async upsert(
    activitiesToUpdate: Activity[],
    activitiesToInsert: Omit<Activity, 'id' | 'userId'>[],
    activitiesToDelete: Activity[],
  ): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.transaction(async (trx) => {
      if (activitiesToUpdate.length) {
        activitiesToUpdate.forEach(async (activity) => {
          await trx(this.#TABLE).where({ id: activity.id }).update(this.activityToRecord(activity));
        });
      }
      activitiesToInsert.length && (await trx(this.#TABLE).insert(activitiesToInsert.map(this.activityToRecord)));
      activitiesToDelete.length &&
        (await trx(this.#TABLE)
          .delete()
          .whereIn(
            'id',
            activitiesToDelete.map(({ id }) => id),
          ));
    });
  }

  async delete(id: number): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn.from(this.#TABLE).delete().where({ id });

    if (result === 0) {
      throw new NotFoundError('Activity does not exist');
    }
  }

  async deleteByUserAndVendor(c2cId: number, vendor: string): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    await conn.from(this.#TABLE).where({ vendor, user_id: c2cId }).delete();
  }

  async deleteByVendorId(vendor: string, vendorId: string): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn.from(this.#TABLE).where({ vendor, vendor_id: vendorId }).delete();

    if (result === 0) {
      throw new NotFoundError('Activity does not exist');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToActivity(row: any): Activity {
    return {
      id: row.id,
      userId: row.user_id,
      vendor: row.vendor,
      vendorId: row.vendor_id,
      date: row.date,
      name: row.name,
      type: row.type,
    };
  }

  private activityToRecord = (activity: Partial<Activity>): Record<string, unknown> => ({
    user_id: activity.userId,
    vendor: activity.vendor,
    vendor_id: activity.vendorId,
    date: activity.date,
    name: activity.name,
    type: activity.type,
  });
}

export const activityRepository = new ActivityRepository();
