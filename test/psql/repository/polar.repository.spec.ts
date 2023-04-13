import { database as db } from '../../../src/db/index.js';
import { PolarRepository } from '../../../src/repository/polar.repository.js';

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
