import { afterEach, describe, expect, it } from 'vitest';

import { database as db } from '../../../src/db/index.ts';
import { StravaRepository } from '../../../src/repository/strava.repository.ts';

describe('Strava Repository', () => {
  afterEach(async () => {
    await db.closeDatabase();
  });

  it('executes requests', async () => {
    const repository = new StravaRepository();

    await expect(repository.findSubscription()).resolves.toBeUndefined();

    await repository.setSubscription(1);

    await expect(repository.findSubscription()).resolves.toEqual(1);
  });
});
