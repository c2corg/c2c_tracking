import type { Request, Response } from 'express';

import { NotFoundError } from '../../errors.ts';
import type { Lang } from '../../helpers/i18n/index.ts';

import { activityService as service } from './activity.service.ts';

class ActivityController {
  public async getUserActivities(req: Request, res: Response): Promise<void> {
    const userId: number = Number.parseInt(req.params['userId'] ?? '', 10);
    const lang: Lang | undefined = req.query['lang'] as Lang | undefined;
    res.json(await service.getActivities(userId, lang));
  }

  public async getUserActivityGeometry(req: Request, res: Response): Promise<void> {
    const userId: number = Number.parseInt(req.params['userId'] ?? '', 10);
    const activityId: number = Number.parseInt(req.params['activityId'] ?? '', 10);
    const geojson = await service.getActivityGeometry(userId, activityId);
    if (!geojson) {
      throw new NotFoundError();
    }
    res.json(geojson);
  }
}

export const controller = new ActivityController();
