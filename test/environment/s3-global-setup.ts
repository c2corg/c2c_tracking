import { BucketAlreadyOwnedByYou, CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

import { retry } from '../../src/helpers/retry.ts';

// Runs once before the s3 tests: creates the bucket, once the server answers (it takes a few seconds to start)
export default async function setup(): Promise<void> {
  const client = new S3Client({
    endpoint: process.env['S3_ENDPOINT'] ?? 'http://localhost:9000/',
    region: process.env['S3_REGION'] ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env['S3_ACCESS_KEY_ID'] ?? 'tracking-access-key',
      secretAccessKey: process.env['S3_SECRET_KEY'] ?? 'tracking-secret-key',
    },
    forcePathStyle: true,
  });
  try {
    await retry(
      async () => {
        try {
          await client.send(new CreateBucketCommand({ Bucket: process.env['S3_BUCKET'] ?? 'tracking' }));
        } catch (error) {
          if (!(error instanceof BucketAlreadyOwnedByYou)) {
            throw error;
          }
        }
      },
      { times: 30, interval: 1000 },
    );
  } finally {
    client.destroy();
  }
}
