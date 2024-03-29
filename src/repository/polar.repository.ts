import config from '../config';
import { database as db } from '../db';
import { IOError } from '../errors';
import { encrypt, decrypt } from '../helpers/utils';

type PolarRow = {
  id: number;
  webhook_secret: string;
};
export class PolarRepository {
  readonly #TABLE = config.get('db.schema') + '.polar';

  public async findWebhookSecret(): Promise<string | undefined> {
    try {
      const conn = await db.getConnection();
      if (!conn) {
        throw new IOError('No connection to database');
      }
      const rows = await conn<PolarRow>(this.#TABLE).limit(1);

      if (!rows?.[0]) {
        return undefined;
      }

      return decrypt(rows[0].webhook_secret);
    } catch (err) {
      return undefined;
    }
  }

  public async setWebhookSecret(webhookSecret: string): Promise<void> {
    const conn = await db.getConnection();
    if (!conn) {
      throw new IOError('No connection to database');
    }
    await conn<PolarRow>(this.#TABLE)
      .insert({ id: 1, webhook_secret: encrypt(webhookSecret) })
      .onConflict('id')
      .merge();
  }
}

export const polarRepository = new PolarRepository();
