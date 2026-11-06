import { afterEach, describe, expect, it } from 'vitest';

import { database as db } from '../../../src/db/index.ts';
import { PolarRepository } from '../../../src/repository/polar.repository.ts';

describe('Polar Repository', () => {
  afterEach(async () => {
    await db.closeDatabase();
  });

  it('executes requests', async () => {
    const repository = new PolarRepository();

    await expect(repository.findWebhookSecret()).resolves.toBeUndefined();

    await repository.setWebhookSecret('secret');

    await expect(repository.findWebhookSecret()).resolves.toEqual('secret');
  });
});
