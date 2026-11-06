import { z } from 'zod';

import { Lang } from '../../helpers/i18n/index.ts';
import type { ValidationSchema } from '../validator.ts';

export const activities: ValidationSchema = { query: z.object({ lang: Lang.optional() }) };
