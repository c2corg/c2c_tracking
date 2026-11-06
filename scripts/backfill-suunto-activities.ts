/*
 * Re-syncs recent Suunto activities for every user with a linked Suunto account. No specific bug has
 * been confirmed for Suunto (unlike Strava, see backfill-strava-activities.ts) - this is a general
 * recovery tool, not a fix for a known incident. Safe to re-run: addActivities dedupes by vendor+vendorId.
 *
 * Usage: npm run backfill:suunto (in the Docker image: node scripts/backfill-suunto-activities.js)
 * Env: BACKFILL_DELAY_MS (default 1000) - delay between users, to stay under Suunto's rate limits.
 */
import { userRepository } from '../src/repository/user.repository.ts';
import { suuntoService } from '../src/server/suunto/suunto.service.ts';

import { runBackfill } from './backfill-common.ts';

void runBackfill(
  'Suunto',
  () => userRepository.findAllSuuntoUserIds(),
  (c2cId) => suuntoService.resyncActivities(c2cId),
);
