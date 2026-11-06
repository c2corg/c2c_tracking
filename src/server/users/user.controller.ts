import type { Request, Response } from 'express';

import { userService } from '../../user.service.ts';

class UserController {
  public async getStatus(req: Request, res: Response): Promise<void> {
    res.json(await userService.getUserInfo(Number.parseInt(req.params['userId'] ?? '', 10)));
  }
}

export const controller = new UserController();
