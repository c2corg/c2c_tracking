import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import rule from '../../../eslint-rules/require-route-validation.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

new RuleTester().run('require-route-validation', rule, {
  valid: [
    'router.route("/").get(validate(noInput), handler).all(methodNotAllowed);',
    'router.route("/webhook").get(validate(a), handler).post(auth, validate(b), handler).all(methodNotAllowed);',
    'router.get("/", validate(schema), handler);',
    // not routes
    'req.get("Authorization");',
    'config.get("trackers.strava.enabled");',
    'keyv.delete("key");',
    'router.use("/strava", strava);',
  ],
  invalid: [
    {
      code: 'router.route("/").get(handler).all(methodNotAllowed);',
      errors: [{ messageId: 'missing', data: { verb: 'GET' } }],
    },
    {
      code: 'router.route("/webhook").get(validate(a), handler).post(handler).all(methodNotAllowed);',
      errors: [{ messageId: 'missing', data: { verb: 'POST' } }],
    },
    {
      code: 'router.post("/deauthorize/:userId", auth, handler);',
      errors: [{ messageId: 'missing', data: { verb: 'POST' } }],
    },
    {
      code: 'router.route("/").delete(check(x), handler);',
      errors: [{ messageId: 'missing', data: { verb: 'DELETE' } }],
    },
  ],
});
