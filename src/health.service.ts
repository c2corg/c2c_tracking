import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export type Status = {
  startTime: string;
  upTime: string;
  isShuttingDown: boolean;
};

export class HealthService {
  private startTime: number;
  private isShuttingDown = false;

  constructor() {
    this.startTime = Date.now();
  }

  setShuttingDown(): void {
    this.isShuttingDown = true;
  }

  getStatus(): Status {
    return {
      startTime: new Date(this.startTime).toISOString(),
      upTime: dayjs(this.startTime).fromNow(true),
      isShuttingDown: this.isShuttingDown,
    };
  }
}

export const healthService = new HealthService();
