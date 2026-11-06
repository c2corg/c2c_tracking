import { describe, expect, it } from 'vitest';

import { corsOrigin, parseExtraOrigins } from '../../../src/helpers/cors-origin.ts';
import { createMockContext } from '../../utils.ts';

describe('parseExtraOrigins', () => {
  it('returns an empty list for an empty string', () => {
    expect(parseExtraOrigins('')).toEqual([]);
  });

  it('trims, drops blanks and trailing slashes', () => {
    expect(parseExtraOrigins(' https://a.example.org/ , ,https://b.example.org')).toEqual([
      'https://a.example.org',
      'https://b.example.org',
    ]);
  });
});

describe('corsOrigin', () => {
  const origin = corsOrigin('https://www.example.org/', 'https://www.preprod.example.org/,http://localhost:8080');
  const ctxWithOrigin = (value?: string): ReturnType<typeof createMockContext> =>
    createMockContext({ headers: value ? { origin: value } : {} });

  it('allows the main frontend', () => {
    expect(origin(ctxWithOrigin('https://www.example.org'))).toBe('https://www.example.org');
  });

  it('allows an extra origin', () => {
    expect(origin(ctxWithOrigin('https://www.preprod.example.org'))).toBe('https://www.preprod.example.org');
    expect(origin(ctxWithOrigin('http://localhost:8080'))).toBe('http://localhost:8080');
  });

  it('answers with the main frontend for any other origin', () => {
    expect(origin(ctxWithOrigin('https://evil.example.com'))).toBe('https://www.example.org');
    expect(origin(ctxWithOrigin('https://www.example.org.evil.com'))).toBe('https://www.example.org');
    expect(origin(ctxWithOrigin())).toBe('https://www.example.org');
  });

  it('only knows the main frontend without extra origins', () => {
    const only = corsOrigin('https://www.example.org/', '');
    expect(only(ctxWithOrigin('https://www.preprod.example.org'))).toBe('https://www.example.org');
  });
});
