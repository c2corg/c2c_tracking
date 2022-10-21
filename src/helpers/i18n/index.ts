import { z } from 'zod';

import ca from './ca.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import eu from './eu.json';
import fr from './fr.json';
import hu from './hu.json';
import it from './it.json';
import sl from './sl.json';
import zh_CN from './zh_CN.json';

export const Lang = z.enum(['fr', 'en', 'ca', 'eu', 'it', 'de', 'es', 'hu', 'sl', 'zh_CN']);
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
  sl,
  zh_CN,
};
