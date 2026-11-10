/*
 * Dates and times with Temporal (Node 26). "Now" is read from Date.now(), not Temporal.Now: the tests freeze time
 * with fake timers, which only mock Date.
 */

const now = (): Temporal.Instant => Temporal.Instant.fromEpochMilliseconds(Date.now());

/** Seconds since the epoch, now. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Whether a token expiring at `expiresAt` (epoch seconds) is still valid in `marginSeconds`. */
export const expiresLater = (expiresAt: number, marginSeconds = 60): boolean =>
  expiresAt > nowSeconds() + marginSeconds;

/**
 * Seconds since the epoch of a date. A date-time without offset (e.g. `2022-01-01T10:00:00`) is read as UTC, the
 * time zone of the service in production.
 */
export const epochSeconds = (value: string | Date): number => {
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }
  try {
    return Math.floor(Temporal.Instant.from(value).epochMilliseconds / 1000);
  } catch {
    return Math.floor(Temporal.PlainDateTime.from(value).toZonedDateTime('UTC').epochMilliseconds / 1000);
  }
};

/** A UTC offset in minutes as `±HH:MM`. */
export const offsetString = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const minutes = Math.abs(Math.round(offsetMinutes));
  return `${sign}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/**
 * A date as an ISO 8601 date-time at the given UTC offset, to the second: `2022-01-01T11:00:00+01:00`, or with `Z`
 * when the offset is zero.
 */
export const formatWithOffset = (seconds: number, offsetMinutes: number): string => {
  const instant = Temporal.Instant.fromEpochMilliseconds(seconds * 1000);
  return Math.round(offsetMinutes) === 0
    ? instant.toString({ smallestUnit: 'second' })
    : instant
        .toZonedDateTimeISO(offsetString(offsetMinutes))
        .toString({ smallestUnit: 'second', timeZoneName: 'never' });
};

/** Start (00:00:00) and end (23:59:59) in epoch seconds of the UTC day `daysAgo` days before today. */
export const utcDay = (daysAgo = 0): { start: number; end: number } => {
  const day = now().toZonedDateTimeISO('UTC').toPlainDate().subtract({ days: daysAgo });
  const start = day.toZonedDateTime('UTC').epochMilliseconds / 1000;
  return { start, end: start + 24 * 60 * 60 - 1 };
};

/** The UTC date `daysAgo` days before today, as a `YYYYMMDD` number. */
export const utcDateNumber = (daysAgo = 0): number =>
  Number.parseInt(
    now().toZonedDateTimeISO('UTC').toPlainDate().subtract({ days: daysAgo }).toString().replaceAll('-', ''),
    10,
  );

/** Whether a string is an ISO 8601 duration (e.g. `PT1H30M`). */
export const isDuration = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  try {
    Temporal.Duration.from(value);
    return true;
  } catch {
    return false;
  }
};

/** Seconds of an ISO 8601 duration, rounded. */
export const durationSeconds = (value: string): number =>
  Math.round(Temporal.Duration.from(value).total({ unit: 'seconds', relativeTo: now().toZonedDateTimeISO('UTC') }));

/** A duration in words, approximate, as shown by /health: `a few seconds`, `an hour`, `22 days`... */
export const humanizeDuration = (milliseconds: number): string => {
  const ms = Math.abs(milliseconds);
  const seconds = Math.round(ms / 1000);
  const minutes = Math.round(ms / 60_000);
  const hours = Math.round(ms / 3_600_000);
  const days = Math.round(ms / 86_400_000);
  // calendar months and years, counted back from now
  const end = now().toZonedDateTimeISO('UTC');
  const start = end.subtract({ milliseconds: Math.round(ms) });
  const months = Math.round(start.until(end, { largestUnit: 'months' }).total({ unit: 'months', relativeTo: start }));
  const years = Math.round(months / 12);
  // a count of 1 reads as "a minute", "an hour"...
  const count = (n: number, unit: string, one: string): string => (n === 1 ? one : `${n} ${unit}s`);
  if (seconds < 45) return 'a few seconds';
  if (seconds < 90) return 'a minute';
  if (minutes < 45) return count(minutes, 'minute', 'a minute');
  if (minutes < 90) return 'an hour';
  if (hours < 22) return count(hours, 'hour', 'an hour');
  if (hours < 36) return 'a day';
  if (days < 26) return count(days, 'day', 'a day');
  if (days < 46) return 'a month';
  if (days < 320) return count(months, 'month', 'a month');
  if (days < 548) return 'a year';
  return count(years, 'year', 'a year');
};
