import type { Context } from 'koa';

import { AppError } from '../../errors';
import log from '../../helpers/logger';
import type { Activity } from '../../repository/activity';
import { activityRepository } from '../../repository/activity.repository';
import type { LineString } from '../../repository/geojson';
import { userService } from '../../user.service';
import { decathlonService } from '../decathlon/decathlon.service';
import { stravaService } from '../strava/strava.service';
import { suuntoService } from '../suunto/suunto.service';

import { activityService as service } from './activity.service';

class ActivityController {
  async getUserActivities(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt(ctx['params'].userId, 10);
    ctx.body = (await userService.getActivities(userId)).map(({ vendorId, geojson, ...keep }) => keep);
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

        let geojson: LineString | undefined;
        try {
          const stream = await stravaService.getActivityStream(token, activity.vendorId);
          geojson = service.stravaStreamSetToGeoJSON(activity, stream);
        } catch (error: unknown) {
          throw new AppError(404, 'Error: unable to retrieve geometry');
        }
        this.saveGeometry(activity, geojson);
        ctx.body = geojson;
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
        let fit: ArrayBuffer | undefined;
        try {
          fit = await suuntoService.getFIT(token, activity.vendorId);
        } catch (error: unknown) {
          throw new AppError(404, 'Error: unable to retrieve geometry');
        }
        let geojson: LineString | undefined;
        try {
          geojson = service.fitToGeoJSON(fit);
        } catch (error) {
          throw new AppError(404, 'Error: unable to convert Suunto FIT file to geometry');
        }
        this.saveGeometry(activity, geojson);
        ctx.body = geojson;
        ctx.status = 200;
        break;
      }
      case 'decathlon': {
        const token = await decathlonService.getToken(userId);
        if (!token) {
          ctx.log.warn(`Error: unable to acquire valid Decathlon token`);
          ctx.status = 503;
          return;
        }

        let geojson: LineString | undefined;
        try {
          geojson = await decathlonService.getActivityGeometry(token, activity.vendorId);
        } catch (error: unknown) {
          throw new AppError(404, 'Error: unable to retrieve geometry');
        }
        if (!geojson) {
          throw new AppError(404, 'Error: unable to retrieve geometry');
        }
        this.saveGeometry(activity, geojson);
        ctx.body = geojson;
        ctx.status = 200;
        break;
      }
      case 'garmin':
        // should contain data in db and be returned above
        throw new AppError(500, `Error: unable to acquire Garmin geometry`);
      default:
        throw new AppError(400, `Vendor not handled: ${activity.vendor}`);
    }
  }

  async saveGeometry(activity: Activity, geojson: LineString): Promise<void> {
    try {
      await activityRepository.update({ ...activity, geojson });
    } catch (error: unknown) {
      log.warn(`Failed saving geojson for ${activity.vendor} activity ${activity.vendorId}`);
    }
  }
}

export const controller = new ActivityController();
