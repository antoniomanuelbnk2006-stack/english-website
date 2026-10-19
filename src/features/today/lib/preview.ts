import { PRIMARY_NAV } from '@/components/shell/nav-items';
import { QUICK_MINUTES } from '@/features/journal/lib/journal';
import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import { htmlLang, type Locale, type Translate } from '@/lib/i18n';
import { TODAY_SHORTCUTS } from './shortcuts';

/**
 * Lo que la portada necesita para pintar «Hoy» igual que la app: los textos ya en el idioma de la
 * interfaz y los números del día. Solo texto: la portada lo pone con `textContent`.
 */
export interface TodayPreview {
  /** Para el atributo `lang` de la copia. */
  lang: string;
  /** Hoy · Escuchar · Leer · Repasar, y «Más». */
  nav: string[];
  more: string;
  level: CefrLevel;
  /** Barras de nivel encendidas (de 1, A1, a 6, C2). */
  bars: number;
  title: string;
  date: string;
  levelPill: string;
  done: number;
  goal: number;
  goalTitle: string;
  goalProgress: string;
  goalMet: string | null;
  quickTitle: string;
  quickHint: string;
  /** «Escucha» y «Lectura», cada una con sus botones de minutos. */
  quickRows: string[];
  quickMinutes: string[];
  planTitle: string;
  planNote: string;
  plan: { href: string; title: string; hint: string }[];
}

export interface TodayPreviewInput {
  t: Translate;
  locale: Locale;
  level: CefrLevel;
  done: number;
  goal: number;
  dateLabel: string;
  reviewHint: string;
}

/** La copia de «Hoy», con lo mismo que pinta src/app/(app)/hoy/page.tsx. */
export function buildTodayPreview({
  t,
  locale,
  level,
  done,
  goal,
  dateLabel,
  reviewHint,
}: TodayPreviewInput): TodayPreview {
  return {
    lang: htmlLang(locale),
    nav: PRIMARY_NAV.map((item) => t(item.label)),
    more: t('nav.more'),
    level,
    bars: CEFR_LEVELS.indexOf(level) + 1,
    title: t('today.title'),
    date: dateLabel,
    levelPill: t('today.yourLevel', { level }),
    done,
    goal,
    goalTitle: t('today.goal', { min: goal }),
    goalProgress: t('today.goalProgress', { done, goal }),
    goalMet: done >= goal ? t('today.goalMet') : null,
    quickTitle: t('journal.quickTitle'),
    quickHint: t('journal.quickHint'),
    quickRows: [t('journal.quickListening'), t('journal.quickReading')],
    quickMinutes: QUICK_MINUTES.map((n) => t('common.minutes', { n })),
    planTitle: t('today.planTitle'),
    planNote: t('today.planPending'),
    plan: TODAY_SHORTCUTS.map(({ href, title, hint }) => ({
      href,
      title: t(title),
      hint: hint ? t(hint) : reviewHint,
    })),
  };
}
