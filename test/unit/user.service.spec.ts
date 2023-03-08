import { NotFoundError } from '../../src/errors';
import log from '../../src/helpers/logger';
import { miniatureService } from '../../src/miniature.service';
import type { Activity } from '../../src/repository/activity';
import { activityRepository } from '../../src/repository/activity.repository';
import { userRepository } from '../../src/repository/user.repository';
import type { CorosAuth } from '../../src/server/coros/coros.api';
import type { DecathlonAuth } from '../../src/server/decathlon/decathlon.api';
import type { GarminAuth } from '../../src/server/garmin/garmin.api';
import type { PolarAuth } from '../../src/server/polar/polar.api';
import type { StravaAuth } from '../../src/server/strava/strava.api';
import type { SuuntoAuth } from '../../src/server/suunto/suunto.api';
import { UserService } from '../../src/user.service';

describe('User service', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => Promise.resolve());
    jest.spyOn(log, 'warn').mockImplementation(() => Promise.resolve());
    const timers = jest.useFakeTimers();
    timers.setSystemTime(new Date('1970-01-01'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('getUserInfo', () => {
    it('should return user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        strava: { id: 1, accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 3 },
        suunto: { username: 'username' },
      });

      const service = new UserService();
      const info = await service.getUserInfo(1);

      expect(info).toMatchInlineSnapshot(`
        {
          "coros": "not-configured",
          "decathlon": "not-configured",
          "garmin": "not-configured",
          "polar": "not-configured",
          "strava": "configured",
          "suunto": "token-lost",
        }
      `);
      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
    });

    it('returns not configured state', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new UserService();
      const info = await service.getUserInfo(1);

      expect(info).toMatchInlineSnapshot(`
        {
          "coros": "not-configured",
          "decathlon": "not-configured",
          "garmin": "not-configured",
          "polar": "not-configured",
          "strava": "not-configured",
          "suunto": "not-configured",
        }
      `);
      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
    });

    it('should return token lost state', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: { id: '1', webhookId: 'webhookId' },
        garmin: { token: 'token', tokenSecret: 'tokenSecret' },
        strava: { id: 1 },
        suunto: { username: 'username' },
        polar: { id: 1n, token: 'token' },
      });

      const service = new UserService();
      const info = await service.getUserInfo(1);

      expect(info).toMatchInlineSnapshot(`
        {
          "coros": "not-configured",
          "decathlon": "token-lost",
          "garmin": "configured",
          "polar": "configured",
          "strava": "token-lost",
          "suunto": "token-lost",
        }
      `);
      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
    });

    it('should return configured state', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        coros: {
          id: 'id',
          accessToken: 'access_token',
          expiresAt: 1,
          refreshToken: 'refrsh_token',
        },
        decathlon: {
          id: '1',
          webhookId: 'webhokid',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
        garmin: { token: 'token', tokenSecret: 'tokenSecret' },
        strava: { id: 1, accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 3 },
        suunto: { username: 'username', accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 3 },
        polar: { id: 1n, token: 'token' },
      });

      const service = new UserService();
      const info = await service.getUserInfo(1);

      expect(info).toMatchInlineSnapshot(`
        {
          "coros": "configured",
          "decathlon": "configured",
          "garmin": "configured",
          "polar": "configured",
          "strava": "configured",
          "suunto": "configured",
        }
      `);
      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
    });
  });

  describe('configureStrava', () => {
    it('creates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'insert').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: StravaAuth = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 3,
        expires_in: 5,
        athlete: { id: 1 },
      };
      await service.configureStrava(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.insert).toBeCalledTimes(1);
      expect(userRepository.insert).toBeCalledWith({
        c2cId: 1,
        strava: {
          id: 1,
          accessToken: 'access_token',
          expiresAt: 3,
          refreshToken: 'refresh_token',
        },
      });
    });

    it('updates user info', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, garmin: { token: 'token', tokenSecret: 'tokenSecret' } });
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: StravaAuth = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: 3,
        expires_in: 5,
        athlete: { id: 1 },
      };
      await service.configureStrava(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        strava: {
          id: 1,
          accessToken: 'access_token',
          expiresAt: 3,
          refreshToken: 'refresh_token',
        },
        garmin: {
          token: 'token',
          tokenSecret: 'tokenSecret',
        },
      });
    });
  });

  describe('updateStravaAuth', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await expect(
        service.updateStravaAuth(1, {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_at: 10,
          expires_in: 30,
        }),
      ).rejects.toMatchInlineSnapshot('[Error: User 1 not found]');
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('throws if user is not yet configured for strava', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await expect(
        service.updateStravaAuth(1, {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_at: 10,
          expires_in: 30,
        }),
      ).rejects.toMatchInlineSnapshot('[Error: User 1 not configured for Strava]');

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('updates strava info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        strava: {
          id: 1,
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
      });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await service.updateStravaAuth(1, {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: 10,
        expires_in: 30,
      });
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        strava: {
          id: 1,
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: 10,
        },
      });
    });
  });

  describe('clearStravaTokens', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await expect(service.clearStravaTokens(1)).rejects.toBeInstanceOf(NotFoundError);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('does nothing if no auth info is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await service.clearStravaTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('clears tokens', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        strava: { id: 1, accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 1 },
      });
      jest.spyOn(userRepository, 'update').mockResolvedValueOnce({
        c2cId: 1,
        strava: { id: 1 },
      });

      const service = new UserService();
      await service.clearStravaTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        strava: { id: 1 },
      });
    });
  });

  describe('getStravaInfo', () => {
    it('retrieves user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        strava: { id: 1, accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 1 },
      });

      const service = new UserService();
      expect(await service.getStravaInfo(1)).toMatchInlineSnapshot(`
        {
          "accessToken": "access_token",
          "expiresAt": 1,
          "id": 1,
          "refreshToken": "refresh_token",
        }
      `);
    });

    it('returns undefined if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new UserService();
      expect(await service.getStravaInfo(1)).toMatchInlineSnapshot(`undefined`);
    });

    it('returns undefined if info does not exist for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new UserService();
      expect(await service.getStravaInfo(1)).toMatchInlineSnapshot(`undefined`);
    });
  });

  describe('configureSuunto', () => {
    beforeEach(() => {
      const timers = jest.useFakeTimers();
      timers.setSystemTime(new Date('1970-01-01'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('creates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'insert').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: SuuntoAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 5,
        user: 'user1',
      };
      await service.configureSuunto(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.insert).toBeCalledTimes(1);
      expect(userRepository.insert).toBeCalledWith({
        c2cId: 1,
        suunto: {
          username: 'user1',
          accessToken: 'access_token',
          expiresAt: 5,
          refreshToken: 'refresh_token',
        },
      });
    });

    it('updates user info', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, garmin: { token: 'token', tokenSecret: 'tokenSecret' } });
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: SuuntoAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 5,
        user: 'user1',
      };
      await service.configureSuunto(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        suunto: {
          username: 'user1',
          accessToken: 'access_token',
          expiresAt: 5,
          refreshToken: 'refresh_token',
        },
        garmin: {
          token: 'token',
          tokenSecret: 'tokenSecret',
        },
      });
    });
  });

  describe('updateSuuntoAuth', () => {
    beforeEach(() => {
      const timers = jest.useFakeTimers();
      timers.setSystemTime(new Date('1970-01-01'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await expect(
        service.updateSuuntoAuth(1, {
          access_token: 'new_access_token',
          token_type: 'bearer',
          refresh_token: 'new_refresh_token',
          expires_in: 30,
        }),
      ).rejects.toMatchInlineSnapshot('[Error: User 1 not found]');

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('throws if user is not yet configured for suunto', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await expect(
        service.updateSuuntoAuth(1, {
          access_token: 'new_access_token',
          token_type: 'bearer',
          refresh_token: 'new_refresh_token',
          expires_in: 30,
        }),
      ).rejects.toMatchInlineSnapshot('[Error: User 1 not configured for Suunto]');

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('updates suunto info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        suunto: {
          username: 'user1',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
      });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await service.updateSuuntoAuth(1, {
        access_token: 'new_access_token',
        token_type: 'bearer',
        refresh_token: 'new_refresh_token',
        expires_in: 30,
      });
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        suunto: {
          username: 'user1',
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: 30,
        },
      });
    });
  });

  describe('clearSuuntoTokens', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await expect(service.clearSuuntoTokens(1)).rejects.toBeInstanceOf(NotFoundError);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('does nothing if no auth info is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await service.clearSuuntoTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('clears tokens', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        suunto: { username: '1', accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 1 },
      });
      jest.spyOn(userRepository, 'update').mockResolvedValueOnce({
        c2cId: 1,
        suunto: { username: '1' },
      });

      const service = new UserService();
      await service.clearSuuntoTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        suunto: { username: '1' },
      });
    });
  });

  describe('getSuuntoInfo', () => {
    it('retrieves user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        suunto: { username: 'user1', accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 1 },
      });

      const service = new UserService();
      expect(await service.getSuuntoInfo(1)).toMatchInlineSnapshot(`
        {
          "accessToken": "access_token",
          "expiresAt": 1,
          "refreshToken": "refresh_token",
          "username": "user1",
        }
      `);
    });

    it('returns undefined if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new UserService();
      expect(await service.getSuuntoInfo(1)).toMatchInlineSnapshot(`undefined`);
    });

    it('returns undefined if info does not exist for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new UserService();
      expect(await service.getSuuntoInfo(1)).toMatchInlineSnapshot(`undefined`);
    });
  });

  describe('configureGarmin', () => {
    it('creates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'insert').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: GarminAuth = {
        token: 'token',
        tokenSecret: 'tokenSecret',
      };
      await service.configureGarmin(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.insert).toBeCalledTimes(1);
      expect(userRepository.insert).toBeCalledWith({
        c2cId: 1,
        garmin: {
          token: 'token',
          tokenSecret: 'tokenSecret',
        },
      });
    });

    it('updates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        suunto: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 5,
          username: 'user1',
        },
      });
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: GarminAuth = {
        token: 'new_token',
        tokenSecret: 'new_tokenSecret',
      };
      await service.configureGarmin(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        suunto: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 5,
          username: 'user1',
        },
        garmin: {
          token: 'new_token',
          tokenSecret: 'new_tokenSecret',
        },
      });
    });
  });

  describe('getGarminInfo', () => {
    it('retrieves user info', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, garmin: { token: 'token', tokenSecret: 'tokenSecret' } });

      const service = new UserService();
      expect(await service.getGarminInfo(1)).toMatchInlineSnapshot(`
        {
          "token": "token",
          "tokenSecret": "tokenSecret",
        }
      `);
    });

    it('returns undefined if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new UserService();
      expect(await service.getGarminInfo(1)).toMatchInlineSnapshot(`undefined`);
    });

    it('returns undefined if info does not exist for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new UserService();
      expect(await service.getGarminInfo(1)).toMatchInlineSnapshot(`undefined`);
    });
  });

  describe('configureDecathlon', () => {
    beforeEach(() => {
      const timers = jest.useFakeTimers();
      timers.setSystemTime(new Date('1970-01-01'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('creates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'insert').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: DecathlonAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 5,
      };
      await service.configureDecathlon(1, auth, '1', 'webhookId');

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.insert).toBeCalledTimes(1);
      expect(userRepository.insert).toBeCalledWith({
        c2cId: 1,
        decathlon: {
          id: '1',
          accessToken: 'access_token',
          expiresAt: 5,
          refreshToken: 'refresh_token',
          webhookId: 'webhookId',
        },
      });
    });

    it('updates user info', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, garmin: { token: 'token', tokenSecret: 'tokenSecret' } });
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: DecathlonAuth = {
        access_token: 'access_token',
        token_type: 'bearer',
        refresh_token: 'refresh_token',
        expires_in: 5,
      };
      await service.configureDecathlon(1, auth, '1', 'webhookId');

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        decathlon: {
          id: '1',
          accessToken: 'access_token',
          expiresAt: 5,
          refreshToken: 'refresh_token',
          webhookId: 'webhookId',
        },
        garmin: {
          token: 'token',
          tokenSecret: 'tokenSecret',
        },
      });
    });
  });

  describe('updateDecathlonAuth', () => {
    beforeEach(() => {
      const timers = jest.useFakeTimers();
      timers.setSystemTime(new Date('1970-01-01'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await expect(
        service.updateDecathlonAuth(1, {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          token_type: 'bearer',
          expires_in: 30,
        }),
      ).rejects.toMatchInlineSnapshot('[Error: User 1 not found]');

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('throws if user is not yet configured for decathlon', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await expect(
        service.updateDecathlonAuth(1, {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          token_type: 'bearer',
          expires_in: 30,
        }),
      ).rejects.toMatchInlineSnapshot('[Error: User 1 not configured for Decathlon]');

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('updates decathlon info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: {
          id: '1',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
          webhookId: 'webhookId',
        },
      });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await service.updateDecathlonAuth(1, {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        token_type: 'bearer',
        expires_in: 30,
      });
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        decathlon: {
          id: '1',
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresAt: 30,
          webhookId: 'webhookId',
        },
      });
    });
  });

  describe('clearDecathlonTokens', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await expect(service.clearDecathlonTokens(1)).rejects.toBeInstanceOf(NotFoundError);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('does nothing if no auth info is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await service.clearDecathlonTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('clears tokens', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: {
          id: '1',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
          webhookId: 'webhookId',
        },
      });
      jest.spyOn(userRepository, 'update').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: { id: '1', webhookId: 'webhookId' },
      });

      const service = new UserService();
      await service.clearDecathlonTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        decathlon: { id: '1', webhookId: 'webhookId' },
      });
    });
  });

  describe('getDecathlonInfo', () => {
    it('retrieves user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        decathlon: {
          id: '1',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
          webhookId: 'webhookId',
        },
      });

      const service = new UserService();
      expect(await service.getDecathlonInfo(1)).toMatchInlineSnapshot(`
        {
          "accessToken": "access_token",
          "expiresAt": 1,
          "id": "1",
          "refreshToken": "refresh_token",
          "webhookId": "webhookId",
        }
      `);
    });

    it('returns undefined if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);

      const service = new UserService();
      expect(await service.getDecathlonInfo(1)).toMatchInlineSnapshot(`undefined`);
    });

    it('returns undefined if info does not exist for user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });

      const service = new UserService();
      expect(await service.getDecathlonInfo(1)).toMatchInlineSnapshot(`undefined`);
    });
  });

  describe('configurePolar', () => {
    it('creates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'insert').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: PolarAuth = {
        x_user_id: 1n,
        access_token: 'access_token',
        token_type: 'bearer',
      };
      await service.configurePolar(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.insert).toBeCalledTimes(1);
      expect(userRepository.insert).toBeCalledWith({
        c2cId: 1,
        polar: {
          id: 1n,
          token: 'access_token',
        },
      });
    });

    it('updates user info', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, garmin: { token: 'token', tokenSecret: 'tokenSecret' } });
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: PolarAuth = {
        x_user_id: 1n,
        access_token: 'access_token',
        token_type: 'bearer',
      };
      await service.configurePolar(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        polar: {
          id: 1n,
          token: 'access_token',
        },
        garmin: {
          token: 'token',
          tokenSecret: 'tokenSecret',
        },
      });
    });
  });

  describe('configureCoros', () => {
    beforeEach(() => {
      const timers = jest.useFakeTimers();
      timers.setSystemTime(new Date('1970-01-01'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('creates user info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'insert').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: CorosAuth = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        openId: '1',
      };
      await service.configureCoros(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.insert).toBeCalledTimes(1);
      expect(userRepository.insert).toBeCalledWith({
        c2cId: 1,
        coros: {
          id: '1',
          accessToken: 'access_token',
          expiresAt: 2505600,
          refreshToken: 'refresh_token',
        },
      });
    });

    it('updates user info', async () => {
      jest
        .spyOn(userRepository, 'findById')
        .mockResolvedValueOnce({ c2cId: 1, garmin: { token: 'token', tokenSecret: 'tokenSecret' } });
      jest.spyOn(userRepository, 'update').mockImplementationOnce((user) => Promise.resolve(user));

      const service = new UserService();
      const auth: CorosAuth = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        openId: '1',
      };
      await service.configureCoros(1, auth);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        coros: {
          id: '1',
          accessToken: 'access_token',
          expiresAt: 2505600,
          refreshToken: 'refresh_token',
        },
        garmin: {
          token: 'token',
          tokenSecret: 'tokenSecret',
        },
      });
    });
  });

  describe('resetCorosAuthExpiration', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await expect(service.resetCorosAuthExpiration(1)).rejects.toMatchInlineSnapshot('[Error: User 1 not found]');

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('throws if user is not yet configured for suunto', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await expect(service.resetCorosAuthExpiration(1)).rejects.toMatchInlineSnapshot(
        '[Error: User 1 not configured for Coros]',
      );

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('updates coros info', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        coros: {
          id: '1',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 1,
        },
      });
      jest.spyOn(userRepository, 'update').mockImplementation((user) => Promise.resolve(user));

      const service = new UserService();
      await service.resetCorosAuthExpiration(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        coros: {
          id: '1',
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresAt: 2505600,
        },
      });
    });
  });

  describe('clearCorosTokens', () => {
    it('throws if user is not found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(undefined);
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await expect(service.clearCorosTokens(1)).rejects.toBeInstanceOf(NotFoundError);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('does nothing if no auth info is found', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({ c2cId: 1 });
      jest.spyOn(userRepository, 'update');

      const service = new UserService();
      await service.clearCorosTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).not.toBeCalled();
    });

    it('clears tokens', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        c2cId: 1,
        coros: { id: '1', accessToken: 'access_token', refreshToken: 'refresh_token', expiresAt: 1 },
      });
      jest.spyOn(userRepository, 'update').mockResolvedValueOnce({
        c2cId: 1,
        coros: { id: '1' },
      });

      const service = new UserService();
      await service.clearCorosTokens(1);

      expect(userRepository.findById).toBeCalledTimes(1);
      expect(userRepository.findById).toBeCalledWith(1);
      expect(userRepository.update).toBeCalledTimes(1);
      expect(userRepository.update).toBeCalledWith({
        c2cId: 1,
        coros: { id: '1' },
      });
    });
  });

  describe('addActivities', () => {
    it('sorts activities and keep only the most recent ones', async () => {
      const activities: Activity[] = [...Array(30).keys()]
        .map((k) => k + 1)
        .map((k) => ({
          id: k,
          userId: 1,
          vendor: 'strava',
          vendorId: k.toString(),
          date: '2022-01-' + k.toString().padStart(2, '0') + 'T00:00:01Z',
          type: 'RUN',
          geojson: {
            type: 'LineString',
            coordinates: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
          miniature: `${k}.png`,
        }));
      jest.spyOn(activityRepository, 'findByUser').mockResolvedValueOnce(activities);
      jest.spyOn(activityRepository, 'upsert').mockImplementationOnce(() => Promise.resolve());

      const service = new UserService();
      await service.addActivities(1, {
        vendor: 'strava',
        vendorId: '1000',
        date: '2022-06-06T00:00:01Z',
        type: 'RUN',
        geojson: {
          type: 'LineString',
          coordinates: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      });

      expect(activityRepository.upsert).toBeCalledTimes(1);
      expect(activityRepository.upsert).toBeCalledWith(
        [],
        expect.arrayContaining([expect.objectContaining({ vendorId: '1000' })]),
        expect.arrayContaining([expect.objectContaining({ vendorId: '1' })]),
      );
    });

    it('computes miniature for new activities, deletes for deleted ones', async () => {
      const activities: Activity[] = [...Array(30).keys()]
        .map((k) => k + 1)
        .map((k) => ({
          id: k,
          userId: 1,
          vendor: 'strava',
          vendorId: k.toString(),
          date: '2022-01-' + k.toString().padStart(2, '0') + 'T00:00:01Z',
          type: 'RUN',
          geojson: {
            type: 'LineString',
            coordinates: [
              [1.0, 1.0],
              [2.0, 2.0],
            ],
          },
          miniature: `${k}.png`,
        }));
      jest.spyOn(activityRepository, 'findByUser').mockResolvedValueOnce(activities);
      jest.spyOn(miniatureService, 'generateMiniature').mockResolvedValueOnce('toto.png');
      jest.spyOn(miniatureService, 'deleteMiniature').mockResolvedValueOnce(undefined);
      jest.spyOn(activityRepository, 'upsert').mockImplementationOnce(() => Promise.resolve());

      const service = new UserService();
      await service.addActivities(1, {
        vendor: 'strava',
        vendorId: '1000',
        date: '2022-06-06T00:00:01Z',
        type: 'RUN',
        geojson: {
          type: 'LineString',
          coordinates: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      });

      expect(miniatureService.deleteMiniature).toBeCalledTimes(1);
      expect(miniatureService.deleteMiniature).toBeCalledWith('1.png');
      expect(miniatureService.generateMiniature).toBeCalledTimes(1);
      expect(miniatureService.generateMiniature).toBeCalledWith({
        type: 'LineString',
        coordinates: [
          [1.0, 1.0],
          [2.0, 2.0],
        ],
      });
      expect(activityRepository.upsert).toBeCalledTimes(1);
      expect(activityRepository.upsert).toBeCalledWith(
        [],
        expect.arrayContaining([expect.objectContaining({ vendorId: '1000' })]),
        expect.arrayContaining([expect.objectContaining({ vendorId: '1' })]),
      );
    });

    it('updates activity if already present', async () => {
      jest.spyOn(activityRepository, 'findByUser').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          type: 'RUN',
        },
      ]);
      jest.spyOn(activityRepository, 'upsert').mockImplementationOnce(() => Promise.resolve());

      const service = new UserService();
      await service.addActivities(1, {
        vendor: 'strava',
        vendorId: '1',
        date: '2022-01-01T00:00:01Z',
        name: 'newname',
        type: 'FLY',
        geojson: {
          type: 'LineString',
          coordinates: [
            [1.0, 1.0],
            [2.0, 2.0],
          ],
        },
      });

      expect(activityRepository.upsert).toBeCalledTimes(1);
      expect(activityRepository.upsert).toBeCalledWith(
        [
          {
            id: 1,
            userId: 1,
            vendor: 'strava',
            vendorId: '1',
            date: '2022-01-01T00:00:01Z',
            type: 'FLY',
            name: 'newname',
            geojson: {
              type: 'LineString',
              coordinates: [
                [1.0, 1.0],
                [2.0, 2.0],
              ],
            },
          },
        ],
        [],
        [],
      );
    });
  });

  describe('updateActivity', () => {
    it('updates activity', async () => {
      jest.spyOn(activityRepository, 'findByUser').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          name: 'name',
          type: 'RUN',
        },
      ]);
      jest.spyOn(activityRepository, 'update').mockImplementationOnce((activity) => Promise.resolve(activity));

      const service = new UserService();
      await service.updateActivity(1, {
        vendor: 'strava',
        vendorId: '1',
        date: '2022-06-01T00:00:01Z',
        name: 'new name',
        type: 'FLY',
      });

      expect(activityRepository.update).toBeCalledTimes(1);
      expect(activityRepository.update).toBeCalledWith({
        id: 1,
        userId: 1,
        vendor: 'strava',
        vendorId: '1',
        date: '2022-06-01T00:00:01Z',
        name: 'new name',
        type: 'FLY',
      });
    });

    it('fails silently and do nothing if activity is not found', async () => {
      jest.spyOn(activityRepository, 'findByUser').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          name: 'name',
          type: 'RUN',
        },
      ]);
      jest.spyOn(activityRepository, 'update').mockImplementationOnce((activity) => Promise.resolve(activity));

      const service = new UserService();
      await service.updateActivity(1, {
        vendor: 'strava',
        vendorId: '2',
        date: '2022-06-01T00:00:01Z',
        name: 'new name',
        type: 'FLY',
      });

      expect(activityRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteActivity', () => {
    it('deletes in DB', async () => {
      jest.spyOn(activityRepository, 'getMiniatureByVendorId').mockResolvedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByVendorId').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new UserService();
      await service.deleteActivity('strava', '1');

      expect(activityRepository.getMiniatureByVendorId).toBeCalledTimes(1);
      expect(activityRepository.getMiniatureByVendorId).toBeCalledWith('strava', '1');
      expect(activityRepository.deleteByVendorId).toBeCalledTimes(1);
      expect(activityRepository.deleteByVendorId).toBeCalledWith('strava', '1');
      expect(miniatureService.deleteMiniature).not.toBeCalled();
    });

    it('logs if miniature info cannot be retrieved', async () => {
      jest.spyOn(activityRepository, 'getMiniatureByVendorId').mockRejectedValueOnce(undefined);
      jest.spyOn(activityRepository, 'deleteByVendorId').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature');

      const service = new UserService();
      await service.deleteActivity('strava', '1');

      expect(activityRepository.getMiniatureByVendorId).toBeCalledTimes(1);
      expect(activityRepository.getMiniatureByVendorId).toBeCalledWith('strava', '1');
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Failed retrieving miniature info for 1`);
      expect(activityRepository.deleteByVendorId).toBeCalledTimes(1);
      expect(activityRepository.deleteByVendorId).toBeCalledWith('strava', '1');
      expect(miniatureService.deleteMiniature).not.toBeCalled();
    });

    it('logs if miniature cannot be deleted', async () => {
      jest.spyOn(activityRepository, 'getMiniatureByVendorId').mockResolvedValueOnce('miniature.png');
      jest.spyOn(activityRepository, 'deleteByVendorId').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.reject());

      const service = new UserService();
      await service.deleteActivity('strava', '1');

      expect(activityRepository.getMiniatureByVendorId).toBeCalledTimes(1);
      expect(activityRepository.getMiniatureByVendorId).toBeCalledWith('strava', '1');
      expect(activityRepository.deleteByVendorId).toBeCalledTimes(1);
      expect(activityRepository.deleteByVendorId).toBeCalledWith('strava', '1');
      expect(miniatureService.deleteMiniature).toBeCalledTimes(1);
      expect(miniatureService.deleteMiniature).toBeCalledWith('miniature.png');
      expect(log.warn).toBeCalledTimes(1);
      expect(log.warn).toBeCalledWith(`Failed deleting miniature miniature.png`);
    });

    it('deletes miniature', async () => {
      jest.spyOn(activityRepository, 'getMiniatureByVendorId').mockResolvedValueOnce('miniature.png');
      jest.spyOn(activityRepository, 'deleteByVendorId').mockImplementationOnce(() => Promise.resolve());
      jest.spyOn(miniatureService, 'deleteMiniature').mockImplementationOnce(() => Promise.resolve());

      const service = new UserService();
      await service.deleteActivity('strava', '1');

      expect(activityRepository.getMiniatureByVendorId).toBeCalledTimes(1);
      expect(activityRepository.getMiniatureByVendorId).toBeCalledWith('strava', '1');
      expect(activityRepository.deleteByVendorId).toBeCalledTimes(1);
      expect(activityRepository.deleteByVendorId).toBeCalledWith('strava', '1');
      expect(miniatureService.deleteMiniature).toBeCalledTimes(1);
      expect(miniatureService.deleteMiniature).toBeCalledWith('miniature.png');
      expect(log.warn).not.toBeCalled();
    });
  });

  describe('getActivities', () => {
    it('returns user activities', async () => {
      const activities: Activity[] = [
        {
          id: 1,
          userId: 1,
          vendor: 'strava',
          vendorId: '1',
          date: '2022-01-01T00:00:01Z',
          type: 'RUN',
        },
      ];
      jest.spyOn(activityRepository, 'findByUser').mockImplementationOnce(() => Promise.resolve(activities));

      const service = new UserService();
      const result = await service.getActivities(1);

      expect(result).toEqual(activities);
      expect(activityRepository.findByUser).toBeCalledTimes(1);
      expect(activityRepository.findByUser).toBeCalledWith(1);
    });
  });

  describe('getActivity', () => {
    it('returns user activity', async () => {
      const activity: Activity = {
        id: 2,
        userId: 1,
        vendor: 'strava',
        vendorId: '1',
        date: '2022-01-01T00:00:01Z',
        type: 'RUN',
      };
      jest.spyOn(activityRepository, 'findByUserAndId').mockResolvedValueOnce(activity);

      const service = new UserService();
      const result = await service.getActivity(1, 2);

      expect(result).toEqual(activity);
      expect(activityRepository.findByUserAndId).toBeCalledTimes(1);
      expect(activityRepository.findByUserAndId).toBeCalledWith(1, 2);
    });

    it('returns undefined if activity was not found', async () => {
      jest.spyOn(activityRepository, 'findByUserAndId').mockResolvedValueOnce(undefined);

      const service = new UserService();
      const result = await service.getActivity(1, 2);

      expect(result).toBeUndefined();
      expect(activityRepository.findByUserAndId).toBeCalledTimes(1);
      expect(activityRepository.findByUserAndId).toBeCalledWith(1, 2);
    });
  });
});
