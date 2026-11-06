import { afterEach, describe, expect, it, vi } from 'vitest';

import config from '../../src/config.ts';
import { polarService } from '../../src/server/polar/polar.service.ts';
import { stravaService } from '../../src/server/strava/strava.service.ts';
import { setupWebhooks } from '../../src/webhooks.ts';

describe('setupWebhooks', () => {
  const strava = config.get('trackers.strava.enabled');
  const polar = config.get('trackers.polar.enabled');

  afterEach(() => {
    config.set('trackers.strava.enabled', strava);
    config.set('trackers.polar.enabled', polar);
    vi.restoreAllMocks();
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])('sets up the webhooks of the enabled trackers only (Strava %s, Polar %s)', (stravaEnabled, polarEnabled) => {
    config.set('trackers.strava.enabled', stravaEnabled);
    config.set('trackers.polar.enabled', polarEnabled);
    const stravaSetup = vi.spyOn(stravaService, 'setupWebhook').mockResolvedValue(undefined);
    const polarSetup = vi.spyOn(polarService, 'setupWebhook').mockResolvedValue(undefined);

    setupWebhooks();

    expect(stravaSetup).toHaveBeenCalledTimes(stravaEnabled ? 1 : 0);
    expect(polarSetup).toHaveBeenCalledTimes(polarEnabled ? 1 : 0);
  });
});
