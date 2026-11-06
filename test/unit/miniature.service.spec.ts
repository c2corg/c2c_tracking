import { describe, expect, it, vi } from 'vitest';

import { http } from '../../src/helpers/http.ts';
import { MiniatureService } from '../../src/miniature.service.ts';
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
});
