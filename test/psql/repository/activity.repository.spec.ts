import { database as db } from '../../../src/db';
import { ActivityRepository } from '../../../src/repository/activity.repository';

describe('Activity Repository', () => {
  afterEach(async () => {
    await db.closeDatabase();
  });

  it('executes requests', async () => {
    const repository = new ActivityRepository();

    await expect(repository.findByUser(1)).resolves.toHaveLength(0);

    const activity1 = await repository.insert({
      vendor: 'strava',
      vendorId: 'strava1',
      date: '1970-01-01T00:00:01Z',
      type: 'Run',
      userId: 1,
      name: 'name',
    });

    expect(activity1).toEqual({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.any(Number),
      vendor: 'strava',
      vendorId: 'strava1',
      date: '1970-01-01T00:00:01Z',
      type: 'Run',
      userId: 1,
      name: 'name',
    });

    await expect(repository.findByUser(1)).resolves.toEqual([activity1]);

    const activity2 = await repository.insert({
      vendor: 'suunto',
      vendorId: 'suunto1',
      date: '1970-01-01T00:00:01Z',
      type: 'Run',
      userId: 2,
      name: 'name',
      geojson: {
        type: 'LineString',
        coordinates: [[1.0, 1.0, 1.0]],
      },
      miniature: 'miniature.png',
    });

    expect(activity2).toEqual({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.any(Number),
      vendor: 'suunto',
      vendorId: 'suunto1',
      date: '1970-01-01T00:00:01Z',
      type: 'Run',
      userId: 2,
      name: 'name',
      geojson: {
        type: 'LineString',
        coordinates: [[1.0, 1.0, 1.0]],
      },
      miniature: 'miniature.png',
    });

    const activity3 = await repository.insert({
      vendor: 'suunto',
      vendorId: 'suunto2',
      date: '1970-01-01T00:00:01Z',
      type: 'Run',
      userId: 1,
      name: 'name',
    });

    expect(activity3).toEqual({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.any(Number),
      vendor: 'suunto',
      vendorId: 'suunto2',
      date: '1970-01-01T00:00:01Z',
      type: 'Run',
      userId: 1,
      name: 'name',
    });

    await expect(repository.findByUser(1)).resolves.toEqual([activity1, activity3]);
    await expect(repository.findByUser(2)).resolves.toEqual([activity2]);
    await expect(repository.findByUser(99)).resolves.toHaveLength(0);

    await expect(repository.getMiniature(activity2.id)).resolves.toEqual('miniature.png');
    await expect(repository.getMiniature(activity3.id)).resolves.toBeUndefined();
    await expect(repository.getMiniature(999)).resolves.toBeUndefined();

    await expect(repository.findByUserAndId(1, activity1.id)).resolves.toEqual(activity1);
    await expect(repository.findByUserAndId(1, activity2.id)).resolves.toBeUndefined();
    await expect(repository.findByUserAndId(1, 99)).resolves.toBeUndefined();
    await expect(repository.findByUserAndId(2, activity2.id)).resolves.toEqual(activity2);

    await expect(repository.getMiniatureByVendorId('suunto', 'suunto1')).resolves.toEqual('miniature.png');
    await expect(repository.getMiniatureByVendorId('strava', 'strava1')).resolves.toBeUndefined();
    await expect(repository.getMiniatureByVendorId('suunto', 'suunto5')).resolves.toBeUndefined();

    await expect(repository.getMiniaturesByUserAndVendor(2, 'suunto')).resolves.toEqual(['miniature.png']);
    await expect(repository.getMiniaturesByUserAndVendor(1, 'strava')).resolves.toEqual([]);
    await expect(repository.getMiniaturesByUserAndVendor(1, 'suunto')).resolves.toEqual([]);

    await expect(repository.update({ ...activity1, type: 'Mountain Bike' })).resolves.toEqual({
      ...activity1,
      type: 'Mountain Bike',
    });
    await expect(repository.findByUserAndId(1, activity1.id)).resolves.toEqual({ ...activity1, type: 'Mountain Bike' });

    await repository.delete(1);

    await expect(repository.findByUserAndId(1, activity1.id)).resolves.toBeUndefined();

    await repository.upsert(
      [{ ...activity3, name: 'newname' }],
      [
        {
          vendor: 'garmin',
          vendorId: 'garmin1',
          date: '1970-01-01T00:00:01Z',
          type: 'Run',
          userId: 1,
          name: 'name',
        },
      ],
      [activity2],
    );
    await expect(repository.findByUser(1)).resolves.toEqual([
      { ...activity3, name: 'newname' },
      expect.objectContaining({ vendorId: 'garmin1' }),
    ]);
    await expect(repository.findByUser(2)).resolves.toHaveLength(0);

    await repository.deleteByUserAndVendor(1, 'suunto');
    await expect(repository.findByUser(1)).resolves.toEqual([expect.objectContaining({ vendorId: 'garmin1' })]);

    await repository.deleteByVendorId('garmin', 'garmin1');
    await expect(repository.findByUser(1)).resolves.toHaveLength(0);
  });
});
