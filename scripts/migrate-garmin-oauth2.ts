/*
 * Migrates the users linked to Garmin through OAuth 1 to OAuth 2: for each of them, reads the Garmin API user id and
 * exchanges the OAuth 1 token for an OAuth 2 access/refresh token pair. Idempotent: users already migrated are
 * skipped, so it can safely be run again to retry the failures.
 *
 * Prerequisites:
 *   - Garmin has enabled OAuth 2 for the application (request it to connect-support@developer.garmin.com),
 *   - GARMIN_CLIENT_SECRET (OAuth 2) and GARMIN_CONSUMER_SECRET (OAuth 1) are both set.
 *
 * Usage: npm run migrate:garmin
 * Env:
 *   MIGRATE_DELAY_MS (default 1000) - delay between users, to stay under Garmin's rate limits.
 */
import { database } from '../src/db';
import log from '../src/helpers/logger';
import { userRepository } from '../src/repository/user.repository';
import { garminService } from '../src/server/garmin/garmin.service';

const DELAY_MS = Number.parseInt(process.env['MIGRATE_DELAY_MS'] ?? '1000', 10);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

void (async (): Promise<void> => {
  let migrated = 0;
  let failed = 0;

  try {
    const userIds = await userRepository.findAllGarminLegacyUserIds();
    log.info(`Found ${userIds.length} user(s) still linked to Garmin through OAuth 1`);

    for (const c2cId of userIds) {
      try {
        await garminService.migrateLegacyUser(c2cId);
        migrated++;
        log.info(`User ${c2cId}: migrated to Garmin OAuth 2`);
      } catch (error: unknown) {
        failed++;
        log.warn(`User ${c2cId}: Garmin OAuth 2 migration failed`, error instanceof Error ? error : undefined);
      }
      await sleep(DELAY_MS);
    }

    log.info(`Done: ${migrated} user(s) migrated, ${failed} failed`);
    if (failed) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    log.error('Garmin OAuth 2 migration aborted', error instanceof Error ? error : undefined);
    process.exitCode = 1;
  } finally {
    await database.closeDatabase();
  }
})();
