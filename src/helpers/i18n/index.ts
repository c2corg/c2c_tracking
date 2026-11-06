import { z } from 'zod';

import ca from './ca.json' with { type: 'json' };
import de from './de.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };
import es from './es.json' with { type: 'json' };
import eu from './eu.json' with { type: 'json' };
import fr from './fr.json' with { type: 'json' };
import hu from './hu.json' with { type: 'json' };
import it from './it.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };
import sl from './sl.json' with { type: 'json' };
import zh_CN from './zh_CN.json' with { type: 'json' };

export const Lang = z.enum(['fr', 'en', 'ca', 'eu', 'it', 'de', 'es', 'hu', 'ru', 'sl', 'zh_CN']);
export type Lang = z.infer<typeof Lang>;

type Translation = { string: string; context?: string; developer_comment?: string };
export const translations: Record<Lang, Record<string, Translation>> = {
  fr,
  en,
  ca,
  eu,
  it,
  de,
  es,
  hu,
  ru,
  sl,
  zh_CN,
};
