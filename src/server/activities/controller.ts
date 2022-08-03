import type { Context } from 'koa';

import { AppError } from '../../errors';
import FitParser from '../../helpers/fit/fit-parser';
import { userService } from '../../user.service';
import { stravaService } from '../strava/service';
import { suuntoService } from '../suunto/service';

import { activitiesService as service } from './service';

class ActivityController {
  async getUserActivities(ctx: Context): Promise<void> {
    ctx.body = (await userService.getActivities(ctx['params'].userId)).map(({ vendorId, geojson, ...keep }) => keep);
    ctx.status = 200;
  }

  async getUserActivity(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt(ctx['params'].userId, 10);
    const activityId: number = Number.parseInt(ctx['params'].activityId, 10);
    // retrieve activity id and vendor
    const activity = await userService.getActivity(userId, activityId);
    if (!activity) {
      ctx.status = 404;
      return;
    }

    if (activity.geojson) {
      ctx.body = activity.geojson;
      ctx.status = 200;
      return;
    }

    switch (activity.vendor) {
      case 'strava': {
        const token = await stravaService.getToken(userId);
        if (!token) {
          ctx.log.warn(`Error: unable to acquire valid Strava token`);
          ctx.status = 503;
          return;
        }

        const stream = await stravaService.getActivityStream(token, activity.vendorId);
        ctx.body = service.stravaStreamSetToGeoJSON(activity, stream);
        ctx.status = 200;
        break;
      }
      case 'suunto': {
        const token = await suuntoService.getToken(userId);
        if (!token) {
          ctx.log.warn(`Error: unable to acquire valid Suunto token`);
          ctx.status = 503;
          return;
        }
        const fit = await suuntoService.getFIT(token, activity.vendorId);
        try {
          ctx.body = service.suuntoFitToGeoJSON(new FitParser().parse(fit));
          ctx.status = 200;
        } catch (error) {
          throw new AppError(500, 'Error: unable to convert Suunto FIT file to geometry');
        }
        break;
      }
      case 'garmin':
        // should contain data in db and be returned above
        throw new AppError(500, `Error: unable to acquire Garmin geometry`);
      default:
        throw new AppError(400, `Vendor not handled: ${activity.vendor}`);
    }
  }
}

export const controller = new ActivityController();
