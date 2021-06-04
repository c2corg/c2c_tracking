import { Context } from 'koa';

import { AppError } from '../../errors';
import { userService } from '../../user.service';
import { stravaService } from '../strava/service';

class ActivityController {
  public async getUserActivities(ctx: Context): Promise<void> {
    ctx.body = (await userService.getActivities(ctx.params.userId)).map(({ vendorId, ...keep }) => keep);
    ctx.status = 200;
  }

  public async getUserActivity(ctx: Context): Promise<void> {
    // TODO check rights & all
    // retrieve activity id and vendor
    const activity = await userService.getActivity(ctx.params.userId, ctx.params.activityId);
    if (!activity) {
      ctx.status = 404;
      return;
    }

    switch (activity.vendor) {
      case 'strava':
        const token = await stravaService.getToken(ctx.params.userId);
        if (!token) {
          // token could not be renewed
          // TODO what to do exactly?
          ctx.status = 503;
          return;
        }
        ctx.body = await stravaService.getActivityLine(token, activity.vendorId);
        ctx.status = 200;
        break;
      default:
        throw new AppError(400, 'TODO'); // TODO
    }
  }
}

export const controller = new ActivityController();
