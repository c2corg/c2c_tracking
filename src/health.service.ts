import config from './config.ts';
import { humanizeDuration } from './helpers/time.ts';

export type Status = {
  version: string;
  startTime: string;
  upTime: string;
  strava: boolean;
  suunto: boolean;
  garmin: boolean;
  decathlon: boolean;
  polar: boolean;
};

export class HealthService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  public getStatus(): Status {
    return {
      version: config.get('version'),
      startTime: new Date(this.startTime).toISOString(),
      upTime: humanizeDuration(Date.now() - this.startTime),
      strava: config.get('trackers.strava.enabled'),
      suunto: config.get('trackers.suunto.enabled'),
      garmin: config.get('trackers.garmin.enabled'),
      decathlon: config.get('trackers.decathlon.enabled'),
      polar: config.get('trackers.polar.enabled'),
    };
  }
}

export const healthService = new HealthService();
