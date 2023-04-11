import { z } from 'zod';

import { Lang } from '../../helpers/i18n';
import type { ValidationSchema } from '../validator.js';

export const activities: ValidationSchema = { query: z.object({ lang: Lang.optional() }) };
