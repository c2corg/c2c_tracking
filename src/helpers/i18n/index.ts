/* eslint-disable @typescript-eslint/ban-ts-comment */
import { z } from 'zod';

// @ts-ignore
import ca from './ca.json' assert { type: 'json' };
// @ts-ignore
import de from './de.json' assert { type: 'json' };
// @ts-ignore
import en from './en.json' assert { type: 'json' };
// @ts-ignore
import es from './es.json' assert { type: 'json' };
// @ts-ignore
import eu from './eu.json' assert { type: 'json' };
// @ts-ignore
import fr from './fr.json' assert { type: 'json' };
// @ts-ignore
import hu from './hu.json' assert { type: 'json' };
// @ts-ignore
import it from './it.json' assert { type: 'json' };
// @ts-ignore
import ru from './ru.json' assert { type: 'json' };
// @ts-ignore
import sl from './sl.json' assert { type: 'json' };
// @ts-ignore
import zh_CN from './zh_CN.json' assert { type: 'json' };

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
