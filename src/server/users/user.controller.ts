import type { Context } from 'koa';

import { userService } from '../../user.service';

class UserController {
  public async getStatus(ctx: Context): Promise<void> {
    ctx.body = await userService.getUserInfo(Number.parseInt((ctx['params'] as { userId: string }).userId, 10));
  }
}

export const controller = new UserController();
