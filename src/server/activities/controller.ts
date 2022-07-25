import type { Context } from 'koa';

import { AppError } from '../../errors';
import { userService } from '../../user.service';
import { stravaService } from '../strava/service';

class ActivityController {
  public async getUserActivities(ctx: Context): Promise<void> {
    ctx.body = (await userService.getActivities(ctx['params'].userId)).map(({ vendorId, ...keep }) => keep);
    ctx.status = 200;
  }

  public async getUserActivity(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt(ctx['params'].userId, 10);
    const activityId: number = Number.parseInt(ctx['params'].activityId, 10);
    // TODO check rights & all
    // retrieve activity id and vendor
    const activity = await userService.getActivity(userId, activityId);
    if (!activity) {
      ctx.status = 404;
      return;
    }

    switch (activity.vendor) {
      case 'strava':
        const token = await stravaService.getToken(userId);
        if (!token) {
          ctx.log.warn(`Error: unable to acquire valid token`);
          ctx.status = 503;
          return;
        }
        ctx.body = await stravaService.getActivityLine(token, activity.vendorId);
        ctx.status = 200;
        break;
      default:
        throw new AppError(400, `Vendor not handled: ${activity.vendor}`);
    }
  }
}

export const controller = new ActivityController();
