/*
 * Re-syncs recent Decathlon activities for every user with a linked Decathlon account. No specific bug
 * has been confirmed for Decathlon (unlike Strava, see backfill-strava-activities.ts) - this is a
 * general recovery tool, not a fix for a known incident. Safe to re-run: addActivities dedupes by
 * vendor+vendorId.
 *
 * Usage: npm run backfill:decathlon (in the Docker image: node scripts/backfill-decathlon-activities.js)
 * Env: BACKFILL_DELAY_MS (default 1000) - delay between users, to stay under Decathlon's rate limits.
 */
import { userRepository } from '../src/repository/user.repository.ts';
import { decathlonService } from '../src/server/decathlon/decathlon.service.ts';

import { runBackfill } from './backfill-common.ts';

void runBackfill(
  'Decathlon',
  () => userRepository.findAllDecathlonUserIds(),
  (c2cId) => decathlonService.resyncActivities(c2cId),
);
