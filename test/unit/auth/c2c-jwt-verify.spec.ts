import verify, { verifyWithOffset } from '../../../src/auth/c2c-jwt-verify';

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

describe('verifyWithOffset', () => {
  const offset = 1_000_000_000;

  it('shifts the user id', () => {
    const done = jest.fn((): void => undefined);
    verifyWithOffset(offset)({ sub: '123' }, done);

    expect(done).toHaveBeenCalledWith(null, { id: offset + 123 });
  });

  it.each([offset, offset + 1, -1, 'abc', 2_000_000_000])('rejects the subject %p', (sub) => {
    const done = jest.fn((): void => undefined);
    verifyWithOffset(offset)({ sub }, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('rejects payload without sub', () => {
    const done = jest.fn((): void => undefined);
    verifyWithOffset(offset)({}, done);

    expect(done).toHaveBeenCalledWith(null, false);
  });
});
