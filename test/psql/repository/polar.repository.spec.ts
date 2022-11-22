import { database as db } from '../../../src/db';
import { PolarRepository } from '../../../src/repository/polar.repository';

describe('Polar Repository', () => {
  afterEach(() => {
    db.closeDatabase();
  });

  it('executes requests', async () => {
    const repository = new PolarRepository();

    await expect(repository.findWebhookSecret()).resolves.toBeUndefined();

    await repository.setWebhookSecret('secret');

    await expect(repository.findWebhookSecret()).resolves.toEqual('secret');
  });
});
