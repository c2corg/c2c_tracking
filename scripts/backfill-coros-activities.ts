/*
 * Re-syncs recent (last 30 days) Coros workouts for every user with a linked Coros account. No specific
 * bug has been confirmed for Coros (unlike Strava, see backfill-strava-activities.ts) - this is a
 * general recovery tool, not a fix for a known incident. Safe to re-run: addActivities dedupes by
 * vendor+vendorId.
 *
 * Usage: npm run backfill:coros
 * Env: BACKFILL_DELAY_MS (default 1000) - delay between users, to stay under Coros's rate limits.
 */
import { userRepository } from '../src/repository/user.repository';
import { corosService } from '../src/server/coros/coros.service';

import { runBackfill } from './backfill-common';

void runBackfill(
  'Coros',
  () => userRepository.findAllCorosUserIds(),
  (c2cId) => corosService.resyncActivities(c2cId),
);
