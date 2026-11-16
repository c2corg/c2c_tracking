import { toC2cActivities } from '../../c2c-activities.ts';
import { epochSeconds } from '../../helpers/time.ts';
import type { Activity, Vendor } from '../../repository/activity.ts';

/*
 * One outing often reaches us several times: the watch vendor (Garmin, Coros, Suunto...) uploads it to
 * Strava, and the user linked both. The rows stay separate in the DB, so that each vendor's webhooks
 * (update, delete, deauthorization) keep working on their own; they are grouped when listed.
 */

// same start and end, give or take the clock of each vendor and a trimmed end
const maxStartGapSeconds = 120;
const maxEndGapSeconds = 300;
// a vendor may measure the length its own way
const maxRelativeLengthGap = 0.05;
const minLengthGapMeters = 200;
// a point's last value is its time when it is an epoch (seconds), never an altitude
const minEpochSeconds = 1_000_000_000;

export type ActivitySource = Pick<Activity, 'id' | 'vendor' | 'vendorId'>;

// typeVendor: the vendor whose type the entry shows, to map it to c2c activities
export type GroupedActivity = Activity & { typeVendor: Vendor; sources: ActivitySource[] };

const startSeconds = (activity: Activity): number => epochSeconds(activity.date);

/**
 * From the time of the last point: the duration may be the moving time (auto pause) for one vendor and the
 * elapsed time for another.
 */
const endSeconds = (activity: Activity): number | undefined => {
  const time = activity.geojson?.coordinates.at(-1)?.at(-1);
  if (time !== undefined && time >= minEpochSeconds) {
    return time;
  }
  return activity.duration === undefined ? undefined : startSeconds(activity) + activity.duration;
};

const closeEnds = (a: Activity, b: Activity): boolean => {
  const [endA, endB] = [endSeconds(a), endSeconds(b)];
  return endA === undefined || endB === undefined || Math.abs(endA - endB) <= maxEndGapSeconds;
};

const closeLengths = ({ length: a }: Activity, { length: b }: Activity): boolean =>
  a === undefined ||
  b === undefined ||
  Math.abs(a - b) <= Math.max(minLengthGapMeters, maxRelativeLengthGap * Math.max(a, b));

export const isSameOuting = (a: Activity, b: Activity): boolean =>
  a.vendor !== b.vendor &&
  Math.abs(startSeconds(a) - startSeconds(b)) <= maxStartGapSeconds &&
  closeEnds(a, b) &&
  closeLengths(a, b);

const points = (activity: Activity): number => activity.geojson?.coordinates.length ?? 0;

/**
 * The best sampled track, as we simplify it anyway; the other rows fill in what it lacks (Garmin has
 * no name, a miniature may have failed).
 */
// lower is better: a type that maps to c2c activities, then Strava, where users name and fix their activities
const typeRank = ({ vendor, type }: Activity): number =>
  (toC2cActivities(vendor, type).length ? 0 : 2) + (vendor === 'strava' ? 0 : 1);

const merge = (group: Activity[]): GroupedActivity => {
  const all = [...group].sort((a, b) => points(b) - points(a));
  const [primary] = all as [Activity];
  // stable sort: the best sampled track wins a tie
  const [typed] = [...all].sort((a, b) => typeRank(a) - typeRank(b)) as [Activity];
  const name = all.find((activity) => activity.name)?.name;
  const length = all.find((activity) => activity.length)?.length;
  const duration = all.find((activity) => activity.duration)?.duration;
  const heightDiffUp = all.find((activity) => activity.heightDiffUp)?.heightDiffUp;
  const miniature = all.find((activity) => activity.miniature)?.miniature;
  return {
    ...primary,
    type: typed.type,
    typeVendor: typed.vendor,
    ...(name && { name }),
    ...(length && { length }),
    ...(duration && { duration }),
    ...(heightDiffUp && { heightDiffUp }),
    ...(miniature && { miniature }),
    sources: all.map(({ id, vendor, vendorId }) => ({ id, vendor, vendorId })),
  };
};

/** Groups the activities of one user that are the same outing seen by several vendors; keeps the order. */
export const groupDuplicates = (activities: Activity[]): GroupedActivity[] => {
  const groups: Activity[][] = [];
  for (const activity of activities) {
    const group = groups.find(
      (candidates) =>
        !candidates.some(({ vendor }) => vendor === activity.vendor) &&
        candidates.some((candidate) => isSameOuting(candidate, activity)),
    );
    if (group) {
      group.push(activity);
    } else {
      groups.push([activity]);
    }
  }
  return groups.map(merge);
};
