import type { Context } from 'koa';

import { NotFoundError } from '../../errors';
import { userService } from '../../user.service';

import { activityService as service } from './activity.service';

class ActivityController {
  public async getUserActivities(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt(ctx['params'].userId, 10);
    ctx.body = (await userService.getActivities(userId)).map(({ vendorId, geojson, ...keep }) => keep);
  }

  public async getUserActivity(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt(ctx['params'].userId, 10);
    const activityId: number = Number.parseInt(ctx['params'].activityId, 10);
    const geojson = await service.getActivity(userId, activityId);
    if (!geojson) {
      throw new NotFoundError();
    }
    ctx.body = geojson;
  }
}

export const controller = new ActivityController();
