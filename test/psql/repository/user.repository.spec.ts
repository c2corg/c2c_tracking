import { database as db } from '../../../src/db';
import type { User } from '../../../src/repository/user.js';
import { UserRepository } from '../../../src/repository/user.repository';

describe('User Repository', () => {
  afterEach(async () => {
    await db.closeDatabase();
  });

  it('executes requests', async () => {
    const repository = new UserRepository();

    await expect(repository.findById(1)).resolves.toEqual({ c2cId: 1 });
    await expect(repository.findById(2)).resolves.toEqual({ c2cId: 2 });
    await expect(repository.findById(99)).resolves.toBeUndefined();

    await expect(repository.insert({ c2cId: 3 })).resolves.toEqual({ c2cId: 3 });

    const user1: User = {
      c2cId: 1,
      strava: { id: 1, accessToken: 'strava_access_token', refreshToken: 'strava_refresh_token', expiresAt: 1 },
      suunto: {
        username: '2',
        accessToken: 'suunto_access_token',
        refreshToken: 'suunto_refresh_token',
        expiresAt: 2,
      },
      garmin: { token: 'garmin_token', tokenSecret: 'garmin_token_secret' },
      decathlon: {
        id: '1',
        accessToken: 'decathlon_access_token',
        refreshToken: 'decathlon_refresh_token',
        expiresAt: 1,
        webhookId: 'webhookId',
      },
      polar: { token: 'polar_token', id: 1n },
      coros: { id: '1', accessToken: 'coros_access_token', refreshToken: 'coros_refresh_token', expiresAt: 1 },
    };
    await expect(repository.update(user1)).resolves.toEqual(user1);

    await expect(repository.findByStravaId(1)).resolves.toEqual(user1);
    await expect(repository.findByStravaId(99)).resolves.toBeUndefined();
    await expect(repository.findBySuuntoUsername('2')).resolves.toEqual(user1);
    await expect(repository.findBySuuntoUsername('99')).resolves.toBeUndefined();
    await expect(repository.findByGarminToken('garmin_token')).resolves.toEqual(user1);
    await expect(repository.findByGarminToken('unknown_token')).resolves.toBeUndefined();
    await expect(repository.findByDecathlonId('1')).resolves.toEqual(user1);
    await expect(repository.findByDecathlonId('99')).resolves.toBeUndefined();
    await expect(repository.findByPolarId(1n)).resolves.toEqual(user1);
    await expect(repository.findByPolarId(99n)).resolves.toBeUndefined();
    await expect(repository.findByCorosId('1')).resolves.toEqual(user1);
    await expect(repository.findByCorosId('2')).resolves.toBeUndefined();
  });
});
