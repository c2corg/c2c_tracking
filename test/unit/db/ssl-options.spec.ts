import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { sslOptions } from '../../../src/db/index';

describe('database sslOptions', () => {
  let dir: string;
  let caFile: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'db-ssl-'));
    caFile = path.join(dir, 'ca.crt');
    writeFileSync(caFile, 'the authority');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('has no TLS options without SSL', () => {
    expect(sslOptions({ ssl: false, sslRejectUnauthorized: true, sslCaFile: caFile })).toBeUndefined();
  });

  it('does not check the server by default (as before)', () => {
    expect(sslOptions({ ssl: true, sslRejectUnauthorized: false, sslCaFile: '' })).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('checks the server against the system authorities', () => {
    expect(sslOptions({ ssl: true, sslRejectUnauthorized: true, sslCaFile: '' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('checks the server against the given authority', () => {
    expect(sslOptions({ ssl: true, sslRejectUnauthorized: true, sslCaFile: caFile })).toEqual({
      rejectUnauthorized: true,
      ca: Buffer.from('the authority'),
    });
  });

  it('fails on an unreadable authority file', () => {
    expect(() =>
      sslOptions({ ssl: true, sslRejectUnauthorized: true, sslCaFile: path.join(dir, 'missing.crt') }),
    ).toThrow();
  });
});
