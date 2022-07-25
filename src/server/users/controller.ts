import type { Context } from 'koa';

import { userService } from '../../user.service';

class UserController {
  public async getStatus(ctx: Context): Promise<void> {
    ctx.body = {
      strava: !!(await userService.getStravaInfo(ctx['params'].userId)),
    };
    ctx.status = 200;
  }
}

export const controller = new UserController();
