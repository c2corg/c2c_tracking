import axios from 'axios';

import { MiniatureService } from '../../src/miniature.service';
import { storage } from '../../src/storage/storage.js';

jest.mock('axios');

describe('Miniature service', () => {
  describe('generateMiniature', () => {
    it('simplifies geometry and returns image from API', async () => {
      const data = new ArrayBuffer(1);
      jest.mocked(axios).get.mockResolvedValueOnce({ data });
      jest.spyOn(storage, 'put').mockResolvedValueOnce(undefined);

      const service = new MiniatureService();
      const id = await service.generateMiniature({
        type: 'LineString',
        coordinates: [
          [1.0, 1.0],
          [2.0, 2.0],
        ],
      });

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(storage.put).toHaveBeenCalledTimes(1);
      expect(id).toMatch(/^.*\.png$/);
    });
  });

  describe('deleteMiniature', () => {
    it('calls storage to delete miniature', async () => {
      jest.spyOn(storage, 'delete').mockResolvedValueOnce(undefined);

      const service = new MiniatureService();
      await service.deleteMiniature('id.png');

      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledWith('id.png');
    });
  });
});
