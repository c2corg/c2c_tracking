import config from './config.ts';
import { polarService } from './server/polar/polar.service.ts';
import { stravaService } from './server/strava/strava.service.ts';

// Subscribes to the webhooks of the enabled trackers that need it at startup
export const setupWebhooks = (): void => {
  if (config.get('trackers.strava.enabled')) {
    void stravaService.setupWebhook();
  }
  if (config.get('trackers.polar.enabled')) {
    void polarService.setupWebhook();
  }
};
