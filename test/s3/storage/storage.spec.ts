import { readFileSync } from 'fs';
import { resolve } from 'path';

import { ObjectCannedACL } from '@aws-sdk/client-s3';
import request from 'supertest';

import config from '../../../src/config';
import { S3Storage } from '../../../src/storage/storage';

const key = 'mtctivk0hjf1wkbckcnyz2rd.png';
// eslint-disable-next-line security/detect-non-literal-fs-filename
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

    // put file in temp storage for processing
    await storage.put(key, buffer);
    await expect(storage.exists(key)).resolves.toBe(true);

    // ensure that the file is public
    await request(storage.baseUrl).get(`/${key}`).expect(200).expect('Content-Type', 'image/png');

    // cleaning
    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);

    // delete a file that does not exist
    await expect(storage.delete('does_not_exist.png')).resolves.toBeUndefined();
  });
});
