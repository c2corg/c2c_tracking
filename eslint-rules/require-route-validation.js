// Every route validates its input with validate(...) from src/server/validator.ts: route chains
// (`router.route(path).get(...)`) and direct routes (`router.get(path, ...)`)
const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/** @type {(node: import('estree').Node) => boolean} */
const isRouteChain = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.property.type === 'Identifier' &&
  (node.callee.property.name === 'route' ||
    ((VERBS.has(node.callee.property.name) || node.callee.property.name === 'all') &&
      isRouteChain(node.callee.object)));

/** @type {(node: import('estree').Node) => boolean} */
const isRouter = (node) => node.type === 'Identifier' && node.name === 'router';

/** @type {(node: import('estree').Node) => boolean} */
const isValidateCall = (node) =>
  node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'validate';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'require validate(...) on every route' },
    messages: {
      missing:
        'Validate the input of this {{verb}} route with validate(...): params, query, headers and body (validate(noInput) when it reads nothing).',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') {
          return;
        }
        const verb = callee.property.name;
        if (!VERBS.has(verb) || !(isRouteChain(callee.object) || isRouter(callee.object))) {
          return;
        }
        if (!node.arguments.some(isValidateCall)) {
          context.report({ node: callee.property, messageId: 'missing', data: { verb: verb.toUpperCase() } });
        }
      },
    };
  },
};
