/*
 * Requests Garmin to replay activity webhook notifications for every user with a linked Garmin account,
 * covering the last BACKFILL_GARMIN_DAYS days (default 30). Unlike the other vendors, Garmin delivers
 * the actual activity data asynchronously via the normal webhook afterwards - this script only sends the
 * replay requests, it doesn't recover activities directly. Garmin caps each request to roughly a 90-day
 * window, so longer ranges are chunked into multiple sequential calls per user.
 *
 * Usage: BACKFILL_GARMIN_DAYS=180 npm run backfill:garmin
 * Env:
 *   BACKFILL_GARMIN_DAYS (default 30) - total number of days of history to request.
 *   BACKFILL_DELAY_MS (default 1000) - delay between requests, to stay under Garmin's rate limits.
 */
import { database } from '../src/db';
import log from '../src/helpers/logger';
import { userRepository } from '../src/repository/user.repository';
import { garminService } from '../src/server/garmin/garmin.service';

const DELAY_MS = Number.parseInt(process.env['BACKFILL_DELAY_MS'] ?? '1000', 10);
const TOTAL_DAYS = Number.parseInt(process.env['BACKFILL_GARMIN_DAYS'] ?? '30', 10);
const WINDOW_DAYS = 90; // Garmin's approximate max window per backfill request

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

void (async (): Promise<void> => {
  let processed = 0;
  let failed = 0;
  let requestsSent = 0;

  try {
    const userIds = await userRepository.findAllGarminUserIds();
    log.info(`Found ${userIds.length} user(s) with a linked Garmin account`);

    for (const c2cId of userIds) {
      try {
        let daysRemaining = TOTAL_DAYS;
        let endDaysAgo = 0;
        while (daysRemaining > 0) {
          const windowDays = Math.min(WINDOW_DAYS, daysRemaining);
          await garminService.requestBackfill(c2cId, windowDays, endDaysAgo);
          requestsSent++;
          endDaysAgo += windowDays;
          daysRemaining -= windowDays;
          await sleep(DELAY_MS);
        }
        log.info(`User ${c2cId}: backfill requested for the last ${TOTAL_DAYS} day(s)`);
      } catch (error: unknown) {
        failed++;
        log.warn(`User ${c2cId}: backfill request failed`, error instanceof Error ? error : undefined);
      }
      processed++;
    }

    log.info(
      `Done: ${processed} user(s) processed, ${requestsSent} backfill request(s) sent, ${failed} user(s) failed. ` +
        `Garmin delivers the actual activity data asynchronously via the normal webhook over the following while.`,
    );
  } catch (error: unknown) {
    log.error('Garmin backfill aborted', error instanceof Error ? error : undefined);
    process.exitCode = 1;
  } finally {
    await database.closeDatabase();
  }
})();
