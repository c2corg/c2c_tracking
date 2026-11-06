import type { RequestHandler } from 'express';

// Ends a route chain: `router.route(path).get(...).post(...).all(methodNotAllowed)` answers 405 to the other methods
export const methodNotAllowed: RequestHandler = (req, res) => {
  const route = req.route as { methods: Record<string, boolean> } | undefined;
  const allowed = Object.keys(route?.methods ?? {})
    .filter((method) => method !== '_all')
    .map((method) => method.toUpperCase());
  if (allowed.includes('GET') && !allowed.includes('HEAD')) {
    allowed.push('HEAD');
  }
  res.set('Allow', allowed.join(', ')).type('text/plain').status(405).send('Method Not Allowed');
};
