import { describe, expect, it, vi } from 'vitest';

import { retry } from '../../../src/helpers/retry.ts';

describe('retry', () => {
  it('returns the result of the first success', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('1')).mockResolvedValueOnce('ok');

    await expect(retry(task, { times: 3, interval: 1 })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after the last attempt', async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'));

    await expect(retry(task, { times: 3, interval: 1 })).rejects.toThrow('3');
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('waits between attempts', async () => {
    vi.useFakeTimers();
    try {
      const task = vi.fn().mockRejectedValueOnce(new Error('1')).mockResolvedValueOnce('ok');

      const result = retry(task, { times: 2, interval: 1000 });
      await vi.advanceTimersByTimeAsync(999);
      expect(task).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(result).resolves.toBe('ok');
      expect(task).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
