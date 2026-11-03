import { readFileSync } from 'fs';
import { resolve } from 'path';

import { ObjectCannedACL } from '@aws-sdk/client-s3';
import request from 'supertest';

import config from '../../../src/config';
import { S3Storage } from '../../../src/storage/storage';

const key = 'mtctivk0hjf1wkbckcnyz2rd.png';
const buffer = readFileSync(resolve(__dirname, '../../resources/piano.png'));

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

  // needs an S3 server that applies the public-read ACL (not Garage, used in CI)
  (process.env['S3_SKIP_PUBLIC_CHECK'] === 'true' ? it.skip : it)('serves the files publicly', async () => {
    await storage.put(key, buffer);

    try {
      await request(storage.baseUrl).get(`/${key}`).expect(200).expect('Content-Type', 'image/png');
    } finally {
      await storage.delete(key);
    }
  });
});
