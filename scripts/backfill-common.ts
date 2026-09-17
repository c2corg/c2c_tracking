/*
 * Shared driver for the per-vendor backfill scripts: sequentially re-syncs every user with a linked
 * account for one vendor, tolerating per-user failures, with a delay between users to stay under the
 * vendor's rate limits (BACKFILL_DELAY_MS env var, default 1000ms).
 */
import { database } from '../src/db';
import log from '../src/helpers/logger';

const DELAY_MS = Number.parseInt(process.env['BACKFILL_DELAY_MS'] ?? '1000', 10);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runBackfill(
  vendorName: string,
  findUserIds: () => Promise<number[]>,
  resync: (c2cId: number) => Promise<number>,
): Promise<void> {
  let processed = 0;
  let failed = 0;
  let activitiesRecovered = 0;

  try {
    const userIds = await findUserIds();
    log.info(`Found ${userIds.length} user(s) with a linked ${vendorName} account`);

    for (const c2cId of userIds) {
      try {
        const count = await resync(c2cId);
        activitiesRecovered += count;
        log.info(`User ${c2cId}: ${count} activity(ies) synced`);
      } catch (error: unknown) {
        failed++;
        log.warn(`User ${c2cId}: resync failed`, error instanceof Error ? error : undefined);
      }
      processed++;
      await sleep(DELAY_MS);
    }

    log.info(
      `Done: ${processed} user(s) processed, ${activitiesRecovered} activity(ies) recovered, ${failed} user(s) failed`,
    );
  } catch (error: unknown) {
    log.error(`${vendorName} backfill aborted`, error instanceof Error ? error : undefined);
    process.exitCode = 1;
  } finally {
    await database.closeDatabase();
  }
}
