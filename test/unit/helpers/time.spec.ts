import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  durationSeconds,
  epochSeconds,
  expiresLater,
  formatWithOffset,
  humanizeDuration,
  isDuration,
  nowSeconds,
  offsetString,
  utcDateNumber,
  utcDay,
} from '../../../src/helpers/time.ts';

describe('time', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads now from Date, which fake timers freeze', () => {
    vi.useFakeTimers({ now: new Date('2022-03-04T05:06:07.890Z') });

    expect(nowSeconds()).toBe(1646370367);
    expect(utcDay()).toEqual({ start: 1646352000, end: 1646438399 });
    expect(utcDay(30).start).toBe(1646352000 - 30 * 24 * 3600);
    expect(utcDateNumber()).toBe(20220304);
    expect(utcDateNumber(30)).toBe(20220202);
  });

  it('tells whether a token expires later than the margin', () => {
    vi.useFakeTimers({ now: new Date('1970-01-01T00:00:00Z') });

    expect(expiresLater(61)).toBe(true);
    expect(expiresLater(60)).toBe(false);
    expect(expiresLater(10, 5)).toBe(true);
  });

  it.each([
    ['2022-01-01T10:00:00Z', 1641031200],
    ['2022-01-01T11:00:00+01:00', 1641031200],
    ['2022-01-01T10:00:00.999Z', 1641031200],
    ['2022-01-01T10:00:00', 1641031200], // no offset: UTC
    [new Date('2022-01-01T10:00:00Z'), 1641031200],
  ])('gives the epoch seconds of %s', (value, expected) => {
    expect(epochSeconds(value)).toBe(expected);
  });

  it.each([
    [0, '+00:00'],
    [60, '+01:00'],
    [330, '+05:30'],
    [-210, '-03:30'],
  ])('writes the offset %d as %s', (minutes, expected) => {
    expect(offsetString(minutes)).toBe(expected);
  });

  it('formats a date at an offset, to the second', () => {
    expect(formatWithOffset(1641031200, 60)).toBe('2022-01-01T11:00:00+01:00');
    expect(formatWithOffset(1641031200, 0)).toBe('2022-01-01T10:00:00Z');
    expect(formatWithOffset(1641031200, -570)).toBe('2022-01-01T00:30:00-09:30');
  });

  it('reads ISO 8601 durations', () => {
    expect(isDuration('PT1H2M3S')).toBe(true);
    expect(isDuration('PT0.5S')).toBe(true);
    expect(isDuration('one hour')).toBe(false);
    expect(isDuration(undefined)).toBe(false);
    expect(durationSeconds('PT1H2M3S')).toBe(3723);
    expect(durationSeconds('PT1.6S')).toBe(2);
  });

  it.each([
    [10_000, 'a few seconds'],
    [60_000, 'a minute'],
    [10 * 60_000, '10 minutes'],
    [60 * 60_000, 'an hour'],
    [5 * 3600_000, '5 hours'],
    [24 * 3600_000, 'a day'],
    [22 * 24 * 3600_000, '22 days'],
    [30 * 24 * 3600_000, 'a month'],
    [100 * 24 * 3600_000, '3 months'],
    [400 * 24 * 3600_000, 'a year'],
    [800 * 24 * 3600_000, '2 years'],
  ])('describes %d ms as %s', (milliseconds, expected) => {
    expect(humanizeDuration(milliseconds)).toBe(expected);
  });
});
