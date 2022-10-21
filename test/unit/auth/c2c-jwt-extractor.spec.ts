import { createRequest } from 'node-mocks-http';

import c2cJwtExtractor from '../../../src/auth/c2c-jwt-extractor';

describe('c2cJwtExtractor', () => {
  it('retrieves token from header (v6_api way)', () => {
    const req = createRequest({
      headers: {
        authorization: 'JWT token="a-nice-jwt-token"',
      },
    });
    expect(c2cJwtExtractor(req)).toBe('a-nice-jwt-token');
  });

  it('retrieves token from header (bearer)', () => {
    const req = createRequest({
      headers: {
        authorization: 'Bearer a-nice-jwt-token',
      },
    });
    expect(c2cJwtExtractor(req)).toBe('a-nice-jwt-token');
  });

  it('ignores invalid auth header', () => {
    const req = createRequest({
      headers: {
        authorization: 'Basic a-nice-jwt-token"',
      },
    });
    expect(c2cJwtExtractor(req)).toBeNull();
  });
});
