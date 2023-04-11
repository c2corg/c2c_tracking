import type { Except } from 'type-fest';

import { NotFoundError } from '../../errors.js';
import { Lang, translations } from '../../helpers/i18n';
import type { Activity } from '../../repository/activity.js';
import type { LineString } from '../../repository/geojson.js';
import { userService } from '../../user.service';

export class ActivityService {
  public async getActivities(
    userId: number,
    lang?: Lang,
  ): Promise<(Except<Activity, 'geojson' | 'type'> & { type: Partial<Record<Lang, string>> })[]> {
    const langs: Lang[] = lang ? [lang] : Lang.options;
    return (await userService.getActivities(userId)).map(({ geojson, type, ...keep }) => {
      const translated = langs.reduce(
        (acc, l) => ({
          ...acc,
          [l]:
            // eslint-disable-next-line security/detect-object-injection
            translations[l][this.i18nKey(type)]?.string ??
            translations['en'][this.i18nKey(type)]?.string ??
            // eslint-disable-next-line security/detect-object-injection
            translations[l]['unknown']?.string ??
            'Unknown',
        }),
        {},
      );
      return {
        ...keep,
        type: translated,
      };
    });
  }

  private i18nKey(key: string): string {
    return key.replaceAll(/[:_\-, ]/g, '').toLowerCase();
  }

  public async getActivityGeometry(userId: number, activityId: number): Promise<LineString | undefined> {
    // retrieve activity id and vendor
    const activity = await userService.getActivity(userId, activityId);
    if (!activity) {
      throw new NotFoundError();
    }

    return activity.geojson;
  }
}

export const activityService = new ActivityService();
