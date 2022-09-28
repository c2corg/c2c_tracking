import type { Context } from 'koa';

import { userService } from '../../user.service';

class UserController {
  async getStatus(ctx: Context): Promise<void> {
    ctx.body = await userService.getUserInfo(ctx['params'].userId);
    ctx.status = 200;
  }
}

export const controller = new UserController();
