import { database as db } from '../db';
import { IOError, NotFoundError } from '../errors';

import type { Activity, Vendor } from './activity';
import type { LineString } from './geojson';

type ActivityRow = {
  id: number;
  user_id: number;
  vendor: Vendor;
  vendor_id: string;
  date: string;
  name: string | undefined | null;
  type: string;
  geojson: LineString | undefined | null;
};

export class ActivityRepository {
  readonly #TABLE = 'activities';

  async findByUser(userId: number): Promise<Activity[]> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const rows = await conn<ActivityRow>(this.#TABLE).where({ user_id: userId }).orderBy('date', 'desc');

      return rows?.map((row) => this.rowToActivity(row));
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
      const row = await conn<ActivityRow>(this.#TABLE).where({ user_id: userId, id: activityId }).first();

      if (!row) {
        return undefined;
      }

      return this.rowToActivity(row);
    } catch (err) {
      return undefined;
    }
  }

  async insert(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    const result = await conn(this.#TABLE).insert(this.activityToRecord(activity), ['id']);
    return { ...activity, ...result[0]! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  async update(activity: Activity): Promise<Activity> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn(this.#TABLE)
      .where({ id: activity.id })
      .update<ActivityRow>({ ...this.activityToRecord(activity), id: activity.id });
    return activity;
  }

  async upsert(
    activitiesToUpdate: Activity[],
    activitiesToInsert: Omit<Activity, 'id'>[],
    activitiesToDelete: Activity[],
  ): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.transaction(async (trx) => {
      if (activitiesToUpdate.length) {
        activitiesToUpdate.forEach(async (activity) => {
          await trx<ActivityRow>(this.#TABLE).update(this.activityToRecord(activity)).where({ id: activity.id });
        });
      }
      activitiesToInsert.length && (await trx(this.#TABLE).insert(activitiesToInsert.map(this.activityToRecord)));
      activitiesToDelete.length &&
        (await trx<ActivityRow>(this.#TABLE)
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

    const result = await conn<ActivityRow>(this.#TABLE).delete().where({ id });

    if (result === 0) {
      throw new NotFoundError('Activity does not exist');
    }
  }

  async deleteByUserAndVendor(c2cId: number, vendor: Vendor): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    await conn<ActivityRow>(this.#TABLE).delete().where({ vendor, user_id: c2cId });
  }

  async deleteByVendorId(vendor: Vendor, vendorId: string): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn<ActivityRow>(this.#TABLE).where({ vendor, vendor_id: vendorId }).delete();

    if (result === 0) {
      throw new NotFoundError('Activity does not exist');
    }
  }

  private rowToActivity(row: ActivityRow): Activity {
    return {
      id: row.id,
      userId: row.user_id,
      vendor: row.vendor,
      vendorId: row.vendor_id,
      date: row.date,
      type: row.type,
      ...(row.name && { name: row.name }),
      ...(row.geojson && { geojson: row.geojson }),
    };
  }

  private activityToRecord(activity: Omit<Activity, 'id'>): Omit<ActivityRow, 'id'> {
    return {
      type: activity.type,
      user_id: activity.userId,
      vendor: activity.vendor,
      vendor_id: activity.vendorId,
      date: activity.date,
      name: activity.name,
      geojson: activity.geojson,
    };
  }
}

export const activityRepository = new ActivityRepository();
