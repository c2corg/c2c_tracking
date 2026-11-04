import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

import { extractGeometry } from '@c2corg/fit-parser-extract-geometry';
import aes from 'crypto-js/aes.js';
import encUtf8 from 'crypto-js/enc-utf8.js';
import { parse } from 'iso8601-duration';
import type { Except } from 'type-fest';

import config from '../config.ts';
import type { LineString } from '../repository/geojson.ts';

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Except<T, K>;

// allows typescript to infer non nullable
export const truthy = <T>(x: T): x is NonNullable<typeof x> => Boolean(x);

export const semverRegex =
  // eslint-disable-next-line security/detect-unsafe-regex
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const isISO8601Duration = (duration: string | undefined): boolean => {
  if (!duration) {
    return false;
  }
  try {
    parse(duration);
    return true;
  } catch {
    return false;
  }
};

export const fitToGeoJSON = (fit: ArrayBuffer): LineString | undefined => {
  try {
    const coordinates = extractGeometry(new Uint8Array(fit));
    if (!coordinates.length) {
      return undefined;
    }
    return { coordinates, type: 'LineString' };
  } catch {
    return undefined;
  }
};

/*
 * Tokens are stored encrypted with AES-256-GCM, with a key derived from `db.crypto` through scrypt.
 * Format: `v1:` + base64(iv (12 bytes) | auth tag (16 bytes) | ciphertext).
 *
 * Values written before that (crypto-js passphrase mode, i.e. OpenSSL `Salted__` format with a single MD5 round for
 * the key derivation) are still readable, and are naturally replaced by the new format when they are next written.
 */
const ENCRYPTION_PREFIX = 'v1:';
const KEY_SALT = 'c2c_tracking.token-encryption.v1';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: { passphrase: string; key: Buffer } | undefined;

const encryptionKey = (): Buffer => {
  const passphrase = config.get('db.crypto');
  if (cachedKey?.passphrase !== passphrase) {
    // scrypt is deliberately slow: derive once per passphrase
    cachedKey = { passphrase, key: scryptSync(passphrase, KEY_SALT, 32) };
  }
  return cachedKey.key;
};

export const encrypt = (token: string): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ENCRYPTION_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
};

export const decrypt = (token: string): string => {
  if (!token.startsWith(ENCRYPTION_PREFIX)) {
    return aes.decrypt(token, config.get('db.crypto')).toString(encUtf8); // legacy format
  }
  const data = Buffer.from(token.slice(ENCRYPTION_PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, IV_LENGTH));
  decipher.setAuthTag(data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
  return Buffer.concat([decipher.update(data.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString('utf8');
};
