import { setTimeout as sleep } from 'node:timers/promises';

// Runs the task until it succeeds, at most `times` times, waiting `interval` ms between attempts
export const retry = async <T>(
  task: () => Promise<T>,
  { times, interval }: { times: number; interval: number },
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= times) {
        throw error;
      }
      await sleep(interval);
    }
  }
};
