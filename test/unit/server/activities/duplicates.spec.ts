import { describe, expect, it } from 'vitest';

import { epochSeconds } from '../../../../src/helpers/time.ts';
import type { Activity } from '../../../../src/repository/activity.ts';
import { groupDuplicates, isSameOuting } from '../../../../src/server/activities/duplicates.ts';

const track = (points: number): NonNullable<Activity['geojson']> => ({
  type: 'LineString',
  coordinates: Array.from({ length: points }, (_, i) => [5.5, 45 + i / 1000]),
});

// a mountain bike ride uploaded by the watch to Strava, both linked
const garmin: Activity = {
  id: 1,
  userId: 1,
  vendor: 'garmin',
  vendorId: '24919339767',
  date: '2026-10-31T13:47:32+01:00',
  type: 'MOUNTAIN_BIKING',
  length: 38800,
  duration: 12347,
  heightDiffUp: 1051,
  geojson: track(3),
  miniature: 'jhzx7v3zaf4adlqjme216ad0.png',
};
const strava: Activity = {
  id: 2,
  userId: 1,
  vendor: 'strava',
  vendorId: '20806619230',
  date: '2026-10-31T13:47:32+01:00',
  type: 'MountainBikeRide',
  name: "Sortie VTT dans l'après-midi",
  deviceName: 'Garmin Forerunner 965',
  length: 38800,
  duration: 12346,
  heightDiffUp: 1051,
  geojson: track(5),
  miniature: 'rcvthoqne9k09n6b1ig3u0if.png',
};

describe('isSameOuting', () => {
  it('matches the same outing from two vendors', () => {
    expect(isSameOuting(garmin, strava)).toBe(true);
  });

  it('matches across time zone notations and small clock gaps', () => {
    expect(isSameOuting(garmin, { ...strava, date: '2026-10-31T12:48:30Z' })).toBe(true);
  });

  it('does not match two activities of the same vendor', () => {
    expect(isSameOuting(strava, { ...strava, id: 3, vendorId: '3' })).toBe(false);
  });

  it('does not match activities started more than 2 minutes apart', () => {
    expect(isSameOuting(garmin, { ...strava, date: '2026-10-31T13:50:00+01:00' })).toBe(false);
  });

  it('does not match a much shorter activity started at the same time', () => {
    expect(isSameOuting(garmin, { ...strava, length: 30000 })).toBe(false);
    expect(isSameOuting(garmin, { ...strava, duration: 10000 })).toBe(false);
  });

  it('tolerates small length and end differences', () => {
    expect(isSameOuting(garmin, { ...strava, length: 38000, duration: 12100 })).toBe(true);
  });

  it('takes the end from the track, as one vendor may give the moving time', () => {
    const end = epochSeconds(strava.date) + 12346;
    const timed = (points: number[][]): NonNullable<Activity['geojson']> => ({
      type: 'LineString',
      coordinates: points,
    });
    const movingTime = {
      ...garmin,
      duration: 10000,
      geojson: timed([
        [5.5, 45, 200, end - 12346],
        [5.6, 45, 210, end],
      ]),
    };
    const elapsedTime = {
      ...strava,
      geojson: timed([
        [5.5, 45, end - 12346],
        [5.6, 45, end - 60],
      ]),
    };

    expect(isSameOuting(movingTime, elapsedTime)).toBe(true);
    expect(
      isSameOuting(movingTime, {
        ...elapsedTime,
        geojson: timed([
          [5.5, 45, 200, end - 12346],
          [5.6, 45, 200, end - 3600],
        ]),
      }),
    ).toBe(false);
  });

  it('does not take an altitude for a time', () => {
    const highTrack: NonNullable<Activity['geojson']> = {
      type: 'LineString',
      coordinates: [
        [7, 46, 4000],
        [7.1, 46, 4800],
      ],
    };
    expect(isSameOuting({ ...garmin, geojson: highTrack }, strava)).toBe(true);
  });

  it('matches when a vendor gives no length or duration', () => {
    const { length, duration, ...withoutStats } = strava;
    expect(isSameOuting(garmin, withoutStats)).toBe(true);
  });
});

describe('groupDuplicates', () => {
  it('keeps distinct activities apart, in order', () => {
    const other = { ...strava, id: 3, vendorId: '3', date: '2026-10-30T12:03:05+01:00' };
    expect(groupDuplicates([strava, other]).map(({ id, sources }) => [id, sources.length])).toEqual([
      [2, 1],
      [3, 1],
    ]);
  });

  it('shows the best sampled track and fills in what it lacks', () => {
    const { name, miniature, ...stravaWithoutMiniature } = strava;
    const [grouped, ...rest] = groupDuplicates([garmin, { ...stravaWithoutMiniature, name }]);

    expect(rest).toEqual([]);
    expect(grouped).toMatchObject({
      id: 2,
      vendor: 'strava',
      type: 'MountainBikeRide',
      name: "Sortie VTT dans l'après-midi",
      miniature: 'jhzx7v3zaf4adlqjme216ad0.png',
      sources: [
        { id: 2, vendor: 'strava', vendorId: '20806619230', deviceName: 'Garmin Forerunner 965' },
        { id: 1, vendor: 'garmin', vendorId: '24919339767' },
      ],
    });
  });

  it('takes the name of another vendor when the best track has none', () => {
    const [grouped] = groupDuplicates([{ ...garmin, geojson: track(10) }, strava]);

    expect(grouped).toMatchObject({ id: 1, vendor: 'garmin', name: "Sortie VTT dans l'après-midi" });
  });

  it('shows the Strava type, where users fix it, with the track of another vendor', () => {
    const [grouped] = groupDuplicates([
      { ...garmin, type: 'HIKING', geojson: track(10) },
      { ...strava, type: 'BackcountrySki' },
    ]);

    expect(grouped).toMatchObject({ id: 1, vendor: 'garmin', type: 'BackcountrySki', typeVendor: 'strava' });
  });

  it('prefers a type that maps to c2c activities', () => {
    const [grouped] = groupDuplicates([
      { ...garmin, type: 'HIKING' },
      { ...strava, type: 'Workout' },
    ]);

    expect(grouped).toMatchObject({ id: 2, vendor: 'strava', type: 'HIKING', typeVendor: 'garmin' });
  });

  it('groups three vendors, never two activities of one vendor', () => {
    const coros: Activity = { ...garmin, id: 4, vendor: 'coros', vendorId: '4', type: '200' };
    const stravaCopy: Activity = { ...strava, id: 5, vendorId: '5' };
    const groups = groupDuplicates([garmin, strava, coros, stravaCopy]);

    expect(groups.map(({ sources }) => sources.map(({ id }) => id))).toEqual([[2, 1, 4], [5]]);
  });
});
