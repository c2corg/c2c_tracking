import { describe, expect, it } from 'vitest';

import { database } from '../../../src/db/index.ts';

describe('Database', () => {
  it('is reachable', async () => {
    await expect(database.isReachable()).resolves.toBe(true);
  });
});
