/*
 * Re-syncs recent Decathlon activities for every user with a linked Decathlon account. No specific bug
 * has been confirmed for Decathlon (unlike Strava, see backfill-strava-activities.ts) - this is a
 * general recovery tool, not a fix for a known incident. Safe to re-run: addActivities dedupes by
 * vendor+vendorId.
 *
 * Usage: npm run backfill:decathlon
 * Env: BACKFILL_DELAY_MS (default 1000) - delay between users, to stay under Decathlon's rate limits.
 */
import { userRepository } from '../src/repository/user.repository';
import { decathlonService } from '../src/server/decathlon/decathlon.service';

import { runBackfill } from './backfill-common';

void runBackfill(
  'Decathlon',
  () => userRepository.findAllDecathlonUserIds(),
  (c2cId) => decathlonService.resyncActivities(c2cId),
);
