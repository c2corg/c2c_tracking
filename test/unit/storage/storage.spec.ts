import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

import { ListObjectsV2Command, ObjectCannedACL, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { LocalStorage, S3Storage, type StoredObject } from '../../../src/storage/storage.ts';

const key = 'mtctivk0hjf1wkbckcnyz2rd.png';
const buffer = readFileSync(resolve(import.meta.dirname, '../../resources/piano.png'));

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

    // listing
    const listed: StoredObject[] = [];
    for await (const object of storage.list()) {
      listed.push(object);
    }
    expect(listed.map((object) => object.key)).toEqual([key]);
    expect(listed[0]?.lastModified).toBeInstanceOf(Date);

    // cleaning
    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);

    // delete a file that does not exist
    await expect(storage.delete('does_not_exist.png')).rejects.toThrow();
  });
});

// What the S3 storage sends, whatever the server: enforcing the ACL is the provider's job (#2696)
describe('S3 storage requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores the files with the configured ACL, as PNG images', async () => {
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const storage = new S3Storage(
      'bucket',
      {
        endpoint: 'https://sos.example.org/',
        region: 'region',
        credentials: { accessKeyId: 'id', secretAccessKey: 'secret' },
      },
      ObjectCannedACL.public_read,
    );

    await storage.put(key, buffer);

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: 'bucket',
      Key: key,
      ACL: 'public-read',
      ContentType: 'image/png',
    });
    expect(storage.baseUrl).toBe('https://sos.example.org/bucket');
  });
});

describe('S3 storage listing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists all pages of the bucket', async () => {
    const date = new Date('2026-11-12T00:00:00Z');
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({
        Contents: [{ Key: 'a.png', LastModified: date }],
        NextContinuationToken: 'next',
      } as never)
      .mockResolvedValueOnce({ Contents: [{ Key: 'b.png', LastModified: date }] } as never);
    const storage = new S3Storage(
      'bucket',
      {
        endpoint: 'https://sos.example.org/',
        region: 'region',
        credentials: { accessKeyId: 'id', secretAccessKey: 'secret' },
      },
      ObjectCannedACL.public_read,
    );

    const listed: StoredObject[] = [];
    for await (const object of storage.list()) {
      listed.push(object);
    }

    expect(listed).toEqual([
      { key: 'a.png', lastModified: date },
      { key: 'b.png', lastModified: date },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
    expect((send.mock.calls[0]?.[0] as ListObjectsV2Command).input).toEqual({ Bucket: 'bucket' });
    expect((send.mock.calls[1]?.[0] as ListObjectsV2Command).input).toEqual({
      Bucket: 'bucket',
      ContinuationToken: 'next',
    });
  });
});
