import 'server-only';
import { getMinutesOn } from '@/features/journal/server/queries';
import { getProfile } from '@/features/profile/server/queries';
import { getDueCount } from '@/features/srs/server/queries';
import { APP_TIME_ZONE, todayMadrid } from '@/lib/dates';
import { intlLocale } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';

/**
 * Lo que enseña «Hoy»: el nivel, los minutos del día frente al objetivo, la fecha y el repaso
 * pendiente, ya en el idioma de la interfaz. Lo usan la página y la copia de la portada
 * (src/app/api/portada/hoy), así que las dos dicen siempre lo mismo.
 */
export async function getToday() {
  const today = todayMadrid();
  const [t, locale, profile, minutes, due] = await Promise.all([
    getT(),
    getLocale(),
    getProfile(),
    getMinutesOn(today),
    getDueCount(),
  ]);

  const reviewHint =
    due === 0
      ? t('today.reviewNone')
      : due === 1
        ? t('today.reviewDueOne')
        : t('today.reviewDue', { n: due });

  const dateLabel = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: APP_TIME_ZONE,
  }).format(new Date());

  return {
    t,
    locale,
    level: profile.declaredLevel,
    done: Math.round(minutes),
    goal: profile.dailyGoalMin,
    dateLabel,
    reviewHint,
  };
}

export type Today = Awaited<ReturnType<typeof getToday>>;
