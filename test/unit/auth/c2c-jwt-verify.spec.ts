import verify from '../../../src/auth/c2c-jwt-verify';

describe('verify', () => {
  it('accepts payload with sub', () => {
    const done = jest.fn((): void => undefined);
    verify({ sub: 123 }, done);

    expect(done).toBeCalledTimes(1);
    expect(done).toBeCalledWith(null, { id: 123 });
  });

  it('rejects paylaod without sub', () => {
    const done = jest.fn((): void => undefined);
    verify({}, done);

    expect(done).toBeCalledTimes(1);
    expect(done).toBeCalledWith(null, false);
  });
});
