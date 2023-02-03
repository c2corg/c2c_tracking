import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

import { LocalStorage } from '../../../src/storage/storage';

const key = 'mtctivk0hjf1wkbckcnyz2rd.png';
const buffer = readFileSync(resolve(__dirname, '../../resources/piano.png'));

describe('Local storage', () => {
  let storage: LocalStorage;
  beforeAll(() => {
    storage = new LocalStorage(`${tmpdir()}/miniatures`);
  });

  it('handles files', async () => {
    await expect(storage.exists(key)).resolves.toBe(false);

    // put file in temp storage for processing
    await storage.put(key, buffer);
    await expect(storage.exists(key)).resolves.toBe(true);
    await expect(storage.get(key)).resolves.toEqual(buffer);

    // cleaning
    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);

    // delete a file that does not exist
    await expect(storage.delete('does_not_exist.png')).rejects.toThrow();
  });
});
