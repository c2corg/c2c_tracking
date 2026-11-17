import type { Request, Response } from 'express';

import { authenticatedUserId } from '../../auth/user.ts';
import { userService } from '../../user.service.ts';

class UserController {
  public async getStatus(req: Request, res: Response): Promise<void> {
    res.json(await userService.getUserInfo(authenticatedUserId(req)));
  }
}

export const controller = new UserController();
