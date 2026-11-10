# Garmin

For more information, see the docs at <https://developer.garmin.com/>.

## Authentication: OAuth 2 (PKCE)

Garmin retires OAuth 1 at the end of 2026. Users now link their account through the OAuth 2 authorization code flow
with PKCE (`S256`):

1. `GET /garmin/request-token/:userId` generates a code verifier and a `state`, keeps them in Redis for one hour and
   returns `{ url }`, the Garmin consent page (`https://connect.garmin.com/oauth2Confirm`) the frontend redirects to.
2. Garmin redirects to `<FRONTEND_BASE_URL><GARMIN_REDIRECT_URI>` (default `trackers/garmin/exchange-token`) with
   `code` and `state`; the frontend forwards them to `GET /garmin/exchange-token/:userId`.
3. The service checks `state`, exchanges `code` (+ verifier) at `https://diauth.garmin.com/di-oauth2-service/oauth/token`,
   reads the Garmin API user id (`/wellness-api/rest/user/id`) and stores it with the encrypted tokens.

The access token is short-lived and refreshed on demand (`GarminService.getAccessToken`). It is only used for calls
initiated by us (backfill, deregistration): activities are pushed by Garmin through the webhooks.

### Webhooks

With OAuth 2 the notifications no longer carry the OAuth 1 `userAccessToken`: users are matched on the Garmin API
`userId`. Until Garmin stops sending the token, users not migrated yet are still matched through it.

### Migrating the users linked with OAuth 1

Once Garmin has enabled OAuth 2 for the application:

```sh
npm run migrate:garmin
```

For each user, it reads the Garmin user id then exchanges the OAuth 1 token for an OAuth 2 token pair
(`/partner-gateway/rest/user/token-exchange`). It is idempotent: run it again to retry the failures. The OAuth 1 token
keeps working for 30 days after its exchange, and its columns (`garmin_token`, `garmin_token_secret`) are left
untouched.

### Configuration

| Variable                 | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `GARMIN_CONSUMER_KEY`    | Consumer key, also the OAuth 2 client ID                                    |
| `GARMIN_CONSUMER_SECRET` | Client secret: OAuth 2 client secret, and OAuth 1 secret for the migration  |
| `GARMIN_REDIRECT_URI`    | Path appended to `FRONTEND_BASE_URL`, must match the redirect URI on Garmin |
