import '../dotenv';

import log from '../helpers/logger';
import { miniatureService } from '../miniature.service';
import { activityRepository } from '../repository/activity.repository';

export async function start(): Promise<void> {
  const activities = await activityRepository.findWithoutMiniature();
  for (const activity of activities) {
    log.info(`User ${activity.userId} | Vendor ${activity.vendor} | Activity ${activity.id}: no miniature`);
    try {
      if (!activity.geojson) {
        log.warn('No geometry found for ${activity.id}');
        continue;
      }
      const miniature = await miniatureService.generateMiniature(activity.geojson);
      await activityRepository.update({ ...activity, miniature });
    } catch {
      log.warn(`Failed generating & saving miniature for ${activity.id}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait between each API call
  }
}

start();
