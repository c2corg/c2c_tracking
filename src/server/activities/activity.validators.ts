import { z } from 'zod';

import { Lang } from '../../helpers/i18n/index.ts';
import { idParam, type ValidationSchema, userIdParams } from '../validator.ts';

export const activities: ValidationSchema = { params: userIdParams, query: z.object({ lang: Lang.optional() }) };

export const geometry: ValidationSchema = { params: z.object({ userId: idParam, activityId: idParam }) };
