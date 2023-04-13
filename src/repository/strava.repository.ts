import config from '../config.js';
import { database as db } from '../db/index.js';
import { IOError } from '../errors.js';

type StravaRow = {
  id: number;
  subscription_id: number;
};
export class StravaRepository {
  readonly #TABLE = config.get('db.schema') + '.strava';

  public async findSubscription(): Promise<number | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const rows = await conn<StravaRow>(this.#TABLE).limit(1);

      if (!rows?.[0]) {
        return undefined;
      }

      return rows[0].subscription_id;
    } catch (err) {
      return undefined;
    }
  }

  public async setSubscription(subscriptionId: number): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn<StravaRow>(this.#TABLE).insert({ id: 1, subscription_id: subscriptionId }).onConflict('id').merge();
  }
}

export const stravaRepository = new StravaRepository();
