import type { Vendor } from './repository/activity.ts';
import { sports as decathlonSports } from './server/decathlon/sports.ts';

/*
 * The c2c activity of the vendor's activity types that match a single one without doubt, to prefill the outing.
 * The other types match none: mountaineering (mountain_climbing or snow_ice_mixed), generic or multi-pitch climbing
 * (rock_climbing or mountain_climbing), hang gliding and other flying, running, walking, road cycling, resort and
 * cross-country skiing…
 * The keys are the activity types as stored (see each vendor's api).
 */
export type C2cActivity =
  | 'skitouring'
  | 'snow_ice_mixed'
  | 'rock_climbing'
  | 'ice_climbing'
  | 'hiking'
  | 'snowshoeing'
  | 'paragliding'
  | 'mountain_biking'
  | 'via_ferrata';

const strava: Record<string, C2cActivity> = {
  BackcountrySki: 'skitouring',
  Snowshoe: 'snowshoeing',
  Hike: 'hiking',
  MountainBikeRide: 'mountain_biking',
  EMountainBikeRide: 'mountain_biking',
};

const suunto: Record<string, C2cActivity> = {
  SkiTouring: 'skitouring',
  BackcountrySkiing: 'skitouring',
  Splitboarding: 'skitouring',
  SkiMountaineering: 'skitouring',
  SnowShoeing: 'snowshoeing',
  Hiking: 'hiking',
  Trekking: 'hiking',
  MountainBiking: 'mountain_biking',
  EMtb: 'mountain_biking',
  Paragliding: 'paragliding',
};

const coros: Record<string, C2cActivity> = {
  'Ski Touring': 'skitouring',
  Hike: 'hiking',
  'Mountain Bike': 'mountain_biking',
  'E-Mountain Bike': 'mountain_biking',
  'Single-Pitch': 'rock_climbing',
  Bouldering: 'rock_climbing',
};

const polar: Record<string, C2cActivity> = {
  BACKCOUNTRY_SKIING: 'skitouring',
  SNOWSHOE_TREKKING: 'snowshoeing',
  HIKING: 'hiking',
  MOUNTAIN_BIKING: 'mountain_biking',
  VERTICALSPORTS_OUTCLIMBING: 'rock_climbing',
};

const garmin: Record<string, C2cActivity> = {
  BACKCOUNTRY_SKIING_SNOWBOARDING_WS: 'skitouring',
  BACKCOUNTRY_SKIING: 'skitouring',
  BACKCOUNTRY_SNOWBOARDING: 'skitouring',
  SNOW_SHOE_WS: 'snowshoeing',
  HIKING: 'hiking',
  MOUNTAIN_BIKING: 'mountain_biking',
  E_BIKE_MOUNTAIN: 'mountain_biking',
  ROCK_CLIMBING: 'rock_climbing',
  BOULDERING: 'rock_climbing',
};

// Decathlon sport ids (see ./server/decathlon/sports.ts), the activity type is the sport's English name
const decathlonSportIds = new Map<number, C2cActivity>([
  [7, 'paragliding'],
  [154, 'snow_ice_mixed'], // glacier hiking
  [156, 'rock_climbing'],
  [157, 'ice_climbing'],
  [162, 'rock_climbing'], // block climbing
  [166, 'via_ferrata'],
  [168, 'hiking'],
  [170, 'hiking'], // day-hiking
  [172, 'hiking'], // trekking
  [173, 'snowshoeing'],
  [177, 'skitouring'],
  [388, 'mountain_biking'],
  [389, 'mountain_biking'], // cross-country MTB
  [393, 'mountain_biking'], // enduro MTB
  [394, 'mountain_biking'], // all mountain MTB
]);
const decathlon: Record<string, C2cActivity> = Object.fromEntries(
  decathlonSports.flatMap(({ id, translatedNames }) => {
    const activity = decathlonSportIds.get(id);
    return activity && translatedNames['en'] ? [[translatedNames['en'], activity]] : [];
  }),
);

const c2cActivities = new Map<Vendor, ReadonlyMap<string, C2cActivity>>([
  ['strava', new Map(Object.entries(strava))],
  ['suunto', new Map(Object.entries(suunto))],
  ['coros', new Map(Object.entries(coros))],
  ['polar', new Map(Object.entries(polar))],
  ['garmin', new Map(Object.entries(garmin))],
  ['decathlon', new Map(Object.entries(decathlon))],
]);

/**
 * The c2c activities matching the vendor's activity type: one at most, none when unsure.
 */
export const toC2cActivities = (vendor: Vendor, type: string): C2cActivity[] => {
  const activity = c2cActivities.get(vendor)?.get(type);
  return activity ? [activity] : [];
};
