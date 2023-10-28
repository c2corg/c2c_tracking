import type { Except } from 'type-fest';

import config from '../config';
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
  length: number | undefined | null;
  duration: number | undefined | null;
  height_diff_up: number | undefined | null;
  geojson: LineString | undefined | null;
  miniature: string | undefined | null;
};

const isDefined = (s: string | undefined | null): s is string => !!s;

export class ActivityRepository {
  readonly #TABLE = config.get('db.schema') + '.activities';

  public async findByUser(userId: number): Promise<Activity[]> {
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

  public async findByUserAndId(userId: number, activityId: number): Promise<Activity | undefined> {
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

  public async insert(activity: Except<Activity, 'id'>): Promise<Activity> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    const result: Activity[] = await conn(this.#TABLE).insert(this.activityToRecord(activity), ['id']);
    return { ...activity, ...result[0]! };
  }

  public async update(activity: Activity): Promise<Activity> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn(this.#TABLE)
      .where({ id: activity.id })
      .update<ActivityRow>({ ...this.activityToRecord(activity), id: activity.id });
    return activity;
  }

  public async upsert(
    activitiesToUpdate: Activity[],
    activitiesToInsert: Except<Activity, 'id'>[],
    activitiesToDelete: Activity[],
  ): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn.transaction(async (trx) => {
      for (const activity of activitiesToUpdate) {
        await trx<ActivityRow>(this.#TABLE).update(this.activityToRecord(activity)).where({ id: activity.id });
      }
      if (activitiesToInsert.length) {
        await trx(this.#TABLE).insert(activitiesToInsert.map((activities) => this.activityToRecord(activities)));
      }
      if (activitiesToDelete.length) {
        await trx<ActivityRow>(this.#TABLE)
          .delete()
          .whereIn(
            'id',
            activitiesToDelete.map(({ id }) => id),
          );
      }
    });
  }

  public async getMiniature(id: number): Promise<string | undefined> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn<ActivityRow>(this.#TABLE).where({ id });

    if (!result.length) {
      return undefined;
    }

    return result[0]?.miniature ?? undefined;
  }

  public async delete(id: number): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn<ActivityRow>(this.#TABLE).delete().where({ id });

    if (result === 0) {
      throw new NotFoundError('Activity does not exist');
    }
  }

  public async getMiniaturesByUserAndVendor(c2cId: number, vendor: Vendor): Promise<string[]> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn<ActivityRow>(this.#TABLE).where({ vendor, user_id: c2cId });

    return result.map((row) => row.miniature).filter(isDefined);
  }

  public async deleteByUserAndVendor(c2cId: number, vendor: Vendor): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    await conn<ActivityRow>(this.#TABLE).delete().where({ vendor, user_id: c2cId });
  }

  public async getMiniatureByVendorId(vendor: Vendor, vendorId: string): Promise<string | undefined> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }

    const result = await conn<ActivityRow>(this.#TABLE).where({ vendor, vendor_id: vendorId });

    if (!result.length) {
      return undefined;
    }

    return result[0]?.miniature ?? undefined;
  }

  public async deleteByVendorId(vendor: Vendor, vendorId: string): Promise<void> {
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
      ...(row.length && { length: row.length }),
      ...(row.duration && { duration: row.duration }),
      ...(row.height_diff_up && { heightDiffUp: row.height_diff_up }),
      ...(row.geojson && { geojson: row.geojson }),
      ...(row.miniature && { miniature: row.miniature }),
    };
  }

  private activityToRecord(activity: Except<Activity, 'id'>): Except<ActivityRow, 'id'> {
    return {
      type: activity.type,
      user_id: activity.userId,
      vendor: activity.vendor,
      vendor_id: activity.vendorId,
      date: activity.date,
      name: activity.name,
      geojson: activity.geojson,
      length: activity.length,
      duration: activity.duration,
      height_diff_up: activity.heightDiffUp,
      miniature: activity.miniature,
    };
  }
}

export const activityRepository = new ActivityRepository();
