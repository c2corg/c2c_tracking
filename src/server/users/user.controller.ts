import type { Context } from 'koa';

import { userService } from '../../user.service';

class UserController {
  public async getStatus(ctx: Context): Promise<void> {
    ctx.body = await userService.getUserInfo(ctx['params'].userId);
  }
}

export const controller = new UserController();
