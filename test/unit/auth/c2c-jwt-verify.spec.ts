import verify from '../../../src/auth/c2c-jwt-verify.js';

describe('verify', () => {
  it('accepts payload with sub', () => {
    const done = jest.fn((): void => undefined);
    verify({ sub: 123 }, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(null, { id: 123 });
  });

  it('rejects paylaod without sub', () => {
    const done = jest.fn((): void => undefined);
    verify({}, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(null, false);
  });
});
