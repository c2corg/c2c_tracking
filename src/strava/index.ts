import { Context, Middleware } from 'koa';
import Router from 'koa-router';

const helloWorldController: Middleware = async (ctx: Context) => {
  ctx.log.info('Received a request');
  ctx.body = {
    message: 'Hello, World',
  };
};

const router = new Router();

router.get('/', helloWorldController);

export default router;
