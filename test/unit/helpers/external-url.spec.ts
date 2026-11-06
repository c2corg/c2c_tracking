import { describe, expect, it } from 'vitest';

import { isExternalUrl } from '../../../src/helpers/external-url.ts';

describe('isExternalUrl', () => {
  it.each(['https://oss.coros.com/fit/123.fit', 'http://files.example.org/a.fit', 'https://93.184.215.14/a.fit'])(
    'accepts %s',
    (url) => {
      expect(isExternalUrl(url)).toBe(true);
    },
  );

  it.each([
    'not a url',
    'file:///etc/passwd',
    'ftp://files.example.org/a.fit',
    'http://localhost:8080/health',
    'http://api.localhost/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'http://127.0.0.1:8081/metrics',
    'http://10.1.2.3/',
    'http://172.20.0.5/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
  ])('refuses %s', (url) => {
    expect(isExternalUrl(url)).toBe(false);
  });
});
