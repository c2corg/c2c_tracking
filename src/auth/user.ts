import type { Request } from 'express';

/**
 * The user of a request, once its token is verified.
 *
 * `id` is the user in tracking (database, vendor links): the id of the API that issued the token, shifted by
 * auth.jwtExtraIdOffset for the extra secret. `apiUserId` is the id in that API, the one its UI puts in the URLs.
 */
export type AuthenticatedUser = { id: number; apiUserId: number };

/** The id in tracking of the authenticated user. Only behind ensureAuthenticated and ensureUserFromParamsMatchesAuthUser. */
export const authenticatedUserId = (req: Request): number => (req.user as AuthenticatedUser).id;
