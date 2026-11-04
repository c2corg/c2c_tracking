import aes from 'crypto-js/aes';

import config from '../../../src/config';
import { decrypt, encrypt } from '../../../src/helpers/utils';

describe('token encryption', () => {
  it('round-trips values', () => {
    for (const value of ['a-token', '', 'tökën with ünicode ✓', 'x'.repeat(5000)]) {
      expect(decrypt(encrypt(value))).toBe(value);
    }
  });

  it('writes the versioned AES-GCM format, with a different IV each time', () => {
    const first = encrypt('a-token');
    const second = encrypt('a-token');

    expect(first).toMatch(/^v1:[A-Za-z0-9+/]+=*$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('a-token');
  });

  it('still reads values encrypted with the legacy crypto-js format', () => {
    const legacy = aes.encrypt('a-legacy-token', config.get('db.crypto')).toString();

    expect(legacy.startsWith('U2FsdGVkX1')).toBe(true);
    expect(decrypt(legacy)).toBe('a-legacy-token');
  });

  it('rejects tampered values', () => {
    const encrypted = encrypt('a-token');
    const bytes = Buffer.from(encrypted.slice(3), 'base64');
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;

    expect(() => decrypt('v1:' + bytes.toString('base64'))).toThrow();
  });

  it('rejects values encrypted with another key', () => {
    const encrypted = encrypt('a-token');
    const original = config.get('db.crypto');
    config.set('db.crypto', original + '-other');
    try {
      expect(() => decrypt(encrypted)).toThrow();
    } finally {
      config.set('db.crypto', original);
    }
  });
});
