import { readFileSync } from 'fs';
import { resolve } from 'path';

import { ObjectCannedACL } from '@aws-sdk/client-s3';
import { beforeAll, describe, expect, it } from 'vitest';

import config from '../../../src/config.ts';
import { S3Storage } from '../../../src/storage/storage.ts';

const key = 'mtctivk0hjf1wkbckcnyz2rd.png';
const buffer = readFileSync(resolve(import.meta.dirname, '../../resources/piano.png'));

describe('S3 storage', () => {
  let storage: S3Storage;
  beforeAll(() => {
    storage = new S3Storage(
      config.get('miniatures.storage.s3.bucket'),
      {
        endpoint: config.get('miniatures.storage.s3.endpoint'),
        credentials: {
          accessKeyId: config.get('miniatures.storage.s3.accessKeyId'),
          secretAccessKey: config.get('miniatures.storage.s3.secretKey'),
        },
        region: config.get('miniatures.storage.s3.region'),
      },
      ObjectCannedACL.public_read,
    );
  });

  it('handles files', async () => {
    await expect(storage.exists(key)).resolves.toBe(false);

    // put file in storage for processing
    await storage.put(key, buffer);
    await expect(storage.exists(key)).resolves.toBe(true);
    await expect(storage.get(key)).resolves.toEqual(buffer);

    // cleaning
    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);

    // delete a file that does not exist
    await expect(storage.delete('does_not_exist.png')).resolves.toBeUndefined();
  });

  it('serves the files publicly', async () => {
    await storage.put(key, buffer);

    try {
      // anonymous request, as a browser showing the miniature
      const response = await fetch(`${storage.baseUrl}/${key}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(buffer);
    } finally {
      await storage.delete(key);
    }
  });
});
