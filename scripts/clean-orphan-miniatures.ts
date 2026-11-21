/*
 * Lists the miniatures in the storage that no activity references any more, and deletes them with --delete.
 *
 * Context: until the fix of this script's commit, a miniature was left in the storage when its activity was
 * synced again (a new miniature replaced it), when Strava or Garmin notified the deletion of the user's
 * account, or when saving the activities failed. Only files named like a generated miniature and older than
 * one hour are considered, so that a miniature generated for an activity being saved is left alone.
 *
 * Usage: npm run clean:miniatures [-- --delete] (in the Docker image: node scripts/clean-orphan-miniatures.js)
 * Without --delete, only lists the orphans (dry run).
 */
import { database } from '../src/db/index.ts';
import log from '../src/helpers/logger.ts';
import { miniatureService } from '../src/miniature.service.ts';

const dryRun = !process.argv.includes('--delete');

try {
  const orphans = await miniatureService.cleanOrphanMiniatures(dryRun);
  for (const key of orphans) {
    log.info(`Orphan miniature: ${key}`);
  }
  log.info(
    `${orphans.length} orphan miniature(s) ${dryRun ? 'found (dry run, use --delete to delete them)' : 'deleted'}`,
  );
} catch (error: unknown) {
  log.error({ err: error }, 'Orphan miniatures cleanup aborted');
  process.exitCode = 1;
} finally {
  await database.closeDatabase();
}
