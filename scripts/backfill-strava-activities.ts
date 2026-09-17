/*
 * One-off backfill: re-syncs recent Strava activities for every user with a linked Strava account.
 *
 * Context: activity geometry retrieval was silently broken for every Strava activity from before the
 * 2025-09-03 streams-format fix (commit b70ca44) up to v2.5.2. Since both the initial account-link flow
 * and the webhook-driven sync silently drop any activity whose geometry can't be retrieved, no Strava
 * activity was actually stored during that whole window. This script re-fetches each user's most recent
 * activities (Strava's default page size, 30, matches this app's MAX_ACTIVITIES_PER_USER) using the fixed
 * code, so it recovers everything Strava's API can still return. Safe to re-run: userService.addActivities
 * dedupes by vendor+vendorId.
 *
 * Usage: npm run backfill:strava
 * Env: BACKFILL_DELAY_MS (default 1000) - delay between users, to stay under Strava's rate limits.
 */
import { database } from '../src/db';
import log from '../src/helpers/logger';
import { userRepository } from '../src/repository/user.repository';
import { stravaService } from '../src/server/strava/strava.service';

const DELAY_MS = Number.parseInt(process.env['BACKFILL_DELAY_MS'] ?? '1000', 10);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

void (async (): Promise<void> => {
  let processed = 0;
  let failed = 0;
  let activitiesRecovered = 0;

  try {
    const userIds = await userRepository.findAllStravaUserIds();
    log.info(`Found ${userIds.length} user(s) with a linked Strava account`);

    for (const c2cId of userIds) {
      try {
        const count = await stravaService.resyncActivities(c2cId);
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
    log.error('Backfill aborted', error instanceof Error ? error : undefined);
    process.exitCode = 1;
  } finally {
    await database.closeDatabase();
  }
})();
