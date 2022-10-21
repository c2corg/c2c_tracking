import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export type Status = {
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
      startTime: new Date(this.startTime).toISOString(),
      upTime: dayjs(this.startTime).fromNow(true),
    };
  }
}

export const healthService = new HealthService();
