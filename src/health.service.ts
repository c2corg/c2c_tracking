import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import config from './config';

dayjs.extend(relativeTime);

export type Status = {
  version: string;
  startTime: string;
  upTime: string;
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
      upTime: dayjs(this.startTime).fromNow(true),
    };
  }
}

export const healthService = new HealthService();
