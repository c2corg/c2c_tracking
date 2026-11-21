import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../src/helpers/http.ts';
import { MiniatureService } from '../../src/miniature.service.ts';
import { activityRepository } from '../../src/repository/activity.repository.ts';
import { storage } from '../../src/storage/storage.ts';
import { respond } from '../utils.ts';

// the HTTP calls are mocked, not the errors
vi.mock('../../src/helpers/http.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  http: { get: vi.fn(), post: vi.fn(), postForm: vi.fn(), delete: vi.fn() },
}));

describe('Miniature service', () => {
  describe('generateMiniature', () => {
    it('simplifies geometry and returns image from API', async () => {
      const data = new ArrayBuffer(1);
      vi.mocked(http).get.mockResolvedValueOnce(respond(data));
      vi.spyOn(storage, 'put').mockResolvedValueOnce(undefined);

      const service = new MiniatureService();
      const id = await service.generateMiniature({
        type: 'LineString',
        coordinates: [
          [1.0, 1.0],
          [2.0, 2.0],
        ],
      });

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(storage.put).toHaveBeenCalledTimes(1);
      expect(id).toMatch(/^.*\.png$/);
    });
  });

  describe('deleteMiniature', () => {
    it('calls storage to delete miniature', async () => {
      vi.spyOn(storage, 'delete').mockResolvedValueOnce(undefined);

      const service = new MiniatureService();
      await service.deleteMiniature('id.png');

      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledWith('id.png');
    });
  });

  describe('cleanOrphanMiniatures', () => {
    const now = new Date('2026-11-12T12:00:00Z');
    const old = new Date('2026-11-12T10:00:00Z');
    const recent = new Date('2026-11-12T11:30:00Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      vi.spyOn(activityRepository, 'getAllMiniatures').mockResolvedValueOnce(new Set(['referenced.png']));
      const objects = [
        { key: 'referenced.png', lastModified: old },
        { key: 'orphan1.png', lastModified: old },
        { key: 'beingsaved.png', lastModified: recent },
        { key: 'not-a-miniature.txt', lastModified: old },
        { key: 'orphan2.png', lastModified: old },
      ];
      vi.spyOn(storage, 'list').mockImplementationOnce(async function* () {
        yield* await Promise.resolve(objects);
      });
      vi.spyOn(storage, 'delete').mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('lists the old unreferenced miniatures without deleting them in dry run', async () => {
      const service = new MiniatureService();

      await expect(service.cleanOrphanMiniatures(true)).resolves.toEqual(['orphan1.png', 'orphan2.png']);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes the old unreferenced miniatures', async () => {
      const service = new MiniatureService();

      await expect(service.cleanOrphanMiniatures(false)).resolves.toEqual(['orphan1.png', 'orphan2.png']);
      expect(storage.delete).toHaveBeenCalledTimes(2);
      expect(storage.delete).toHaveBeenNthCalledWith(1, 'orphan1.png');
      expect(storage.delete).toHaveBeenNthCalledWith(2, 'orphan2.png');
    });
  });
});
