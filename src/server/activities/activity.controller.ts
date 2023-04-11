import type { Context } from 'koa';

import { NotFoundError } from '../../errors.js';
import type { Lang } from '../../helpers/i18n';

import { activityService as service } from './activity.service.js';

class ActivityController {
  public async getUserActivities(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    const lang: Lang | undefined = ctx.request.query['lang'] as Lang | undefined;
    ctx.body = await service.getActivities(userId, lang);
  }

  public async getUserActivityGeometry(ctx: Context): Promise<void> {
    const userId: number = Number.parseInt((ctx['params'] as { userId: string }).userId, 10);
    const activityId: number = Number.parseInt((ctx['params'] as { activityId: string }).activityId, 10);
    const geojson = await service.getActivityGeometry(userId, activityId);
    if (!geojson) {
      throw new NotFoundError();
    }
    ctx.body = geojson;
  }
}

export const controller = new ActivityController();
