import type { Vendor } from './repository/activity.ts';
import { sports as decathlonSports } from './server/decathlon/sports.ts';

/*
 * Activity types that are never a c2c outing, not even its approach: water sports, swimming and diving, virtual
 * activities (fake GPS track), motor sports, ball, racket and target sports, skating, horse riding, fishing and
 * hunting, sky diving.
 * Kept: on foot, all bikes, all snow sports (resort skiing included), climbing and mountaineering, flying, and the
 * generic or unknown types. Indoor activities (yoga, strength, pool…) have no GPS track: they are dropped anyway.
 * The values are the activity types as stored (see each vendor's api).
 */

const strava = [
  // water
  'Canoeing',
  'Kayaking',
  'Kitesurf',
  'Rowing',
  'Sail',
  'StandUpPaddling',
  'Surfing',
  'Swim',
  'Windsurf',
  // virtual
  'VirtualRide',
  'VirtualRow',
  'VirtualRun',
  // ball, racket and target sports
  'Badminton',
  'Basketball',
  'Cricket',
  'Golf',
  'Padel',
  'Pickleball',
  'Racquetball',
  'Soccer',
  'Squash',
  'TableTennis',
  'Tennis',
  'Volleyball',
  // skating
  'IceSkate',
  'InlineSkate',
  'RollerSki',
  'Skateboard',
];

const suunto = [
  // water
  'Aquathlon',
  'Canoeing',
  'Freediving',
  'Kayaking',
  'KitesurfingKiting',
  'Mermaiding',
  'OpenwaterSwimming',
  'Paddling',
  'Rowing',
  'Sailing',
  'Scubadiving',
  'Snorkeling',
  'Spearfishing',
  'StandupPaddling',
  'Surfing',
  'Swimming',
  'Swimrun',
  'WaterSports',
  'Windsurfing',
  // motor sports
  'Motorsports',
  // ball, racket and target sports
  'AmericanFootball',
  'Badminton',
  'BallGames',
  'Baseball',
  'Basketball',
  'Bowling',
  'Cricket',
  'FieldHockey',
  'Floorball',
  'FrisbeeGolf',
  'Futsal',
  'Golf',
  'Handball',
  'IceHockey',
  'Padel',
  'RacquetBall',
  'Rugby',
  'Soccer',
  'Softball',
  'Squash',
  'TableTennis',
  'Tennis',
  'Volleyball',
  // skating
  'IceSkating',
  'RollerSkating',
  'RollerSkiing',
  'Skateboarding',
  // other
  'Fishing',
  'HorsebackRiding',
  'Hunting',
];

const coros = [
  // water
  'Flatwater',
  'Open Water',
  'Rowing',
  'Speedsurfing',
  'Whitewater',
  'Windsurfing',
  // ball, racket and target sports
  'Badminton',
  'Basketball',
  'Frisbee',
  'Padel',
  'Pickleball',
  'Soccer',
  'Table Tennis',
  'Tennis',
  // skating
  'Skateboard',
  // fishing
  'Boat Fishing',
  'Boat Fly Fishing',
  'Inshore Fishing',
  'Kayak Fishing',
  'Offshore Fishing',
  'Shore Fishing',
  'Shore Fly Fishing',
  'Surf Fishing',
];

const polar = [
  // water
  'AQUATICS',
  'OFFROADTRIATHLON_SWIMMING',
  'OPEN_WATER_SWIMMING',
  'PARASPORTS_WATER_SKIING',
  'ROWING',
  'SWIMMING',
  'TRIATHLON_SWIMMING',
  'WATER_EXERCISE',
  'WATER_RUNNING',
  'WATERSPORTS_CANOEING',
  'WATERSPORTS_KAYAKING',
  'WATERSPORTS_KITESURFING',
  'WATERSPORTS_SAILING',
  'WATERSPORTS_SURFING',
  'WATERSPORTS_WAKEBOARDING',
  'WATERSPORTS_WATERSKI',
  'WATERSPORTS_WINDSURFING',
  // motor sports
  'MOTORSPORTS_CAR_RACING',
  'MOTORSPORTS_ENDURO',
  'MOTORSPORTS_HARD_ENDURO',
  'MOTORSPORTS_MOTOCROSS',
  'MOTORSPORTS_ROADRACING',
  'MOTORSPORTS_SNOCROSS',
  // ball, racket and target sports
  'AMERICAN_FOOTBALL',
  'BADMINTON',
  'BASEBALL',
  'BASKETBALL',
  'BEACH_TENNIS',
  'BEACH_VOLLEYBALL',
  'CRICKET',
  'FIELD_HOCKEY',
  'FINNISH_BASEBALL',
  'FLOORBALL',
  'FRISBEEGOLF',
  'FUTSAL',
  'GOLF',
  'HANDBALL',
  'PADEL',
  'PICKLEBALL',
  'RUGBY',
  'SHOOTING_SPORT_OUTDOOR',
  'SOCCER',
  'SQUASH',
  'TABLE_TENNIS',
  'TENNIS',
  'ULTIMATE',
  'VOLLEYBALL',
  // skating
  'ICE_SKATING',
  'INLINE_SKATING',
  'ROLLER_BLADING',
  'ROLLER_SKIING_CLASSIC',
  'ROLLER_SKIING_FREESTYLE',
  'SKATEBOARDING',
  'SKATING',
  // horse riding
  'RIDING',
  'TROTTING',
];

const garmin = [
  // water
  'BOATING',
  'BOATING_V2',
  'KAYAKING',
  'KAYAKING_V2',
  'KITEBOARDING',
  'KITEBOARDING_V2',
  'LAP_SWIMMING',
  'OFFSHORE_GRINDING',
  'OFFSHORE_GRINDING_V2',
  'ONSHORE_GRINDING',
  'ONSHORE_GRINDING_V2',
  'OPEN_WATER_SWIMMING',
  'PADDLING',
  'PADDLING_V2',
  'ROWING',
  'ROWING_V2',
  'SAILING',
  'SAILING_V2',
  'SNORKELING',
  'STAND_UP_PADDLEBOARDING',
  'STAND_UP_PADDLEBOARDING_V2',
  'SURFING',
  'SURFING_V2',
  'SWIMMING',
  'WAKEBOARDING',
  'WAKEBOARDING_V2',
  'WATER_SPORTS',
  'WATERSKIING',
  'WHITEWATER_RAFTING_KAYAKING',
  'WHITEWATER_RAFTING_V2',
  'WIND_KITE_SURFING',
  'WINDSURFING',
  'WINDSURFING_V2',
  // diving
  'APNEA_DIVING',
  'APNEA_HUNT',
  'CCR_DIVE',
  'DIVING',
  'GAUGE_DIVING',
  'MULTI_GAS_DIVING',
  'SINGLE_GAS_DIVING',
  // virtual
  'VIRTUAL_RIDE',
  'VIRTUAL_RUN',
  // motor sports
  'ATV',
  'AUTO_RACING',
  'DRIVING_GENERAL',
  'MOTOCROSS',
  'MOTORCYCLING',
  'RC_DRONE',
  'SNOWMOBILING_WS',
  // ball, racket and target sports
  'AMERICAN_FOOTBALL',
  'BADMINTON',
  'BASEBALL',
  'BASKETBALL',
  'CRICKET',
  'DISC_GOLF',
  'FIELD_HOCKEY',
  'GOLF',
  'ICE_HOCKEY',
  'LACROSSE',
  'PADEL',
  'PICKLEBALL',
  'PLATFORM_TENNIS',
  'RACKET_SPORTS',
  'RACQUTBALL',
  'RUGBY',
  'SOCCER',
  'SOFTBALL',
  'SQUASH',
  'TABLE_TENNIS',
  'TEAM_SPORTS',
  'TENNIS',
  'TENNIS_V2',
  'ULTIMATE_DISC',
  'VOLLEYBALL',
  // skating
  'INLINE_SKATING',
  'SKATING_WS',
  // other
  'FISHING',
  'FISHING_V2',
  'HORSEBACK_RIDING',
  'HUNTING',
  'HUNTING_FISHING',
  'SKY_DIVING',
  'WINGSUIT_FLYING',
];

// Decathlon sport ids (see ./server/decathlon/sports.ts), the activity type is the sport's English name
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const decathlonSportIds = new Set([
  ...range(10, 33), // ball sports
  ...range(118, 120), // ice skating
  139, // motor boat
  ...range(140, 152), // motor sports, paramotor, aerobatics
  ...range(192, 237), // hunting, horse riding, fishing
  ...range(263, 304), // rowing, kayaking, surfing, swimming, diving, water skiing, sailing
  ...range(305, 308), // crossbow, clay pigeon shooting
  ...range(319, 322), // frisbee, golf, boules
  ...range(324, 334), // paint-ball, archery, shooting
  ...range(335, 359), // racket sports
  ...range(365, 380), // land sailing, roller skating, skateboarding, speed sailing, scooter
]);
const decathlon = decathlonSports
  .filter(({ id }) => decathlonSportIds.has(id))
  .map(({ translatedNames }) => translatedNames['en'])
  .filter((name): name is string => !!name);

const excludedActivityTypes = new Map<Vendor, ReadonlySet<string>>([
  ['strava', new Set(strava)],
  ['suunto', new Set(suunto)],
  ['coros', new Set(coros)],
  ['polar', new Set(polar)],
  ['garmin', new Set(garmin)],
  ['decathlon', new Set(decathlon)],
]);

/**
 * Whether the vendor's activity type is never a c2c outing.
 */
export const isExcludedActivityType = (vendor: Vendor, type: string | undefined): boolean =>
  type !== undefined && !!excludedActivityTypes.get(vendor)?.has(type);
