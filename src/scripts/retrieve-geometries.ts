import '../dotenv';

import log from '../helpers/logger';
import type { Activity } from '../repository/activity';
import { activityRepository } from '../repository/activity.repository';
import type { LineString } from '../repository/geojson';
import { decathlonApi } from '../server/decathlon/decathlon.api';
import { decathlonService } from '../server/decathlon/decathlon.service';
import { stravaService } from '../server/strava/strava.service';
import { suuntoService } from '../server/suunto/suunto.service';

export async function start(): Promise<void> {
  const activities = await activityRepository.findWithoutGeoJSON();
  for (const activity of activities) {
    log.info(`User ${activity.userId} | Vendor ${activity.vendor} | Activity ${activity.id}: no geometry`);
    try {
      await retrieveGeometry(activity);
      log.info('... Geometry retrieved ✔');
    } catch {
      log.info('... No geometry retrieved => delete ❌');
      try {
        await activityRepository.delete(activity.id);
      } catch {
        log.warn('... Error deleting activity');
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10000)); // wait between each API call
  }
  log.info('Done');
}

const retrieveGeometry = async (activity: Activity): Promise<void> => {
  switch (activity.vendor) {
    case 'strava': {
      const token = await stravaService.getToken(activity.userId);
      if (!token) {
        throw new Error('Unable to acquire valid token');
      }

      let geojson: LineString | undefined;
      try {
        geojson = await stravaService.retrieveActivityGeometry(
          token,
          Number.parseInt(activity.vendorId, 10),
          activity.date,
        );
        if (!geojson) {
          throw new Error('No valid geometry');
        }
        saveGeometry(activity, geojson);
      } catch (error: unknown) {
        throw new Error('Unable to retrieve geometry', error instanceof Error ? error : undefined);
      }
      break;
    }
    case 'suunto': {
      const token = await suuntoService.getToken(activity.userId);
      if (!token) {
        throw new Error('Unable to acquire valid token');
      }
      let geojson: LineString | undefined;
      try {
        geojson = await suuntoService.retrieveActivityGeometry(token, Number.parseInt(activity.vendorId, 10));
        if (!geojson) {
          throw new Error('No valid geometry');
        }
        saveGeometry(activity, geojson);
      } catch (error: unknown) {
        throw new Error('Unable to retrieve geometry', error instanceof Error ? error : undefined);
      }
      break;
    }
    case 'decathlon': {
      const token = await decathlonService.getToken(activity.userId);
      if (!token) {
        throw new Error('Unable to acquire valid token');
      }

      let geojson: LineString | undefined;
      try {
        const act = await decathlonApi.getActivity(token, activity.vendorId);
        geojson = await decathlonService.retrieveActivityGeometry(act);
      } catch (error: unknown) {
        throw new Error('Unable to retrieve geometry', error instanceof Error ? error : undefined);
      }
      if (!geojson) {
        throw new Error('Unable to retrieve geometry');
      }
      saveGeometry(activity, geojson);
      break;
    }
    case 'garmin':
      // should contain data in db and be returned above
      throw new Error(`Unable to acquire Garmin geometry`);
    case 'polar':
      // should contain data in db and be returned above
      throw new Error(`Unable to acquire Polar geometry`);
  }
};

const saveGeometry = async (activity: Activity, geojson: LineString): Promise<void> => {
  try {
    await activityRepository.update({ ...activity, geojson });
  } catch (error: unknown) {
    // an error should not prevent returning geojson to the request
  }
};

start();
