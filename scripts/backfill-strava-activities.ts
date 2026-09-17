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
import { userRepository } from '../src/repository/user.repository';
import { stravaService } from '../src/server/strava/strava.service';

import { runBackfill } from './backfill-common';

void runBackfill(
  'Strava',
  () => userRepository.findAllStravaUserIds(),
  (c2cId) => stravaService.resyncActivities(c2cId),
);
