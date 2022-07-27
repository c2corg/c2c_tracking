import { database as db } from '../db';
import { IOError } from '../errors';

export class StravaRepository {
  readonly #TABLE = 'strava';

  async findSubscription(): Promise<number | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const rows = await conn?.table(this.#TABLE).limit(1);

      if (!rows) {
        return undefined;
      }

      return rows[0].subscription_id;
    } catch (err) {
      return undefined;
    }
  }

  async setSubscription(subscriptionId: number): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn?.table(this.#TABLE).insert({ id: 1, subscription_id: subscriptionId }).onConflict('id').merge();
  }
}

export const stravaRepository = new StravaRepository();
