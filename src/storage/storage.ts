import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import sanitize from 'sanitize-filename';
import type { SetRequired } from 'type-fest';

import config from '../config';

export abstract class Storage {
  public abstract exists(key: string): Promise<boolean>;
  public abstract get(key: string): Promise<Buffer>;
  public abstract put(key: string, data: Buffer): Promise<void>;
  public abstract delete(key: string): Promise<void>;
}

export class LocalStorage implements Storage {
  readonly #baseDirectory: string;

  constructor(baseDirectory: string) {
    this.#baseDirectory = baseDirectory;
    /* eslint-disable security/detect-non-literal-fs-filename */
    if (!fs.existsSync(baseDirectory)) {
      fs.mkdirSync(baseDirectory, { recursive: true });
    }
    /* eslint-enable security/detect-non-literal-fs-filename */
  }

  public path(key: string): string {
    return path.resolve(this.#baseDirectory, sanitize(key));
  }

  public async exists(key: string): Promise<boolean> {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.existsSync(this.path(key));
  }

  public async get(key: string): Promise<Buffer> {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.readFileSync(this.path(key));
  }

  public async put(key: string, data: Buffer): Promise<void> {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.writeFileSync(this.path(key), data);
  }

  public async delete(key: string): Promise<void> {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return fs.unlinkSync(this.path(key));
  }
}

type S3ClientBaseConfig = SetRequired<S3ClientConfig, 'endpoint' | 'credentials' | 'region'> & {
  endpoint: string;
};

export class S3Storage implements Storage {
  readonly #endpoint: string;
  readonly #bucketName: string;
  readonly #client: S3Client;
  readonly #defaultACL: ObjectCannedACL;

  constructor(bucketName: string, params: S3ClientBaseConfig, defaultACL: ObjectCannedACL) {
    this.#bucketName = bucketName;
    this.#defaultACL = defaultACL;
    this.#endpoint = params.endpoint;
    this.#client = new S3Client({ ...params, forcePathStyle: true });
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.#client.send(new HeadObjectCommand({ Bucket: this.#bucketName, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  public async get(key: string): Promise<Buffer> {
    const { Body } = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucketName, Key: key }));
    const stream = Body as Readable;
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.once('end', () => resolve(Buffer.concat(chunks)));
      stream.once('error', reject);
    });
  }

  public async put(key: string, data: Buffer): Promise<void> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucketName,
        Key: key,
        Body: data,
        ACL: this.#defaultACL,
        ContentType: 'image/png',
      }),
    );
  }

  public async delete(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucketName, Key: key }));
  }

  public get baseUrl(): string {
    return `${this.#endpoint}/${this.#bucketName}`;
  }
}

let storage: Storage;
switch (config.get('miniatures.storage.backend')) {
  case 's3':
  default:
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
    break;
  case 'local':
    storage = new LocalStorage(config.get('miniatures.storage.local.folder'));
    break;
}
export { storage };
