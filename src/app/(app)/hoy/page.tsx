import { BookOpen, Headphones, Layers, NotebookPen, type LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { RingProgress } from '@/components/ui/ring-progress';
import { QuickLog } from '@/features/journal/components/quick-log';
import { getMinutesOn } from '@/features/journal/server/queries';
import { LevelMeter } from '@/features/level/components/level-meter';
import { getSkillRatings } from '@/features/level/server/queries';
import { getProfile } from '@/features/profile/server/queries';
import { APP_TIME_ZONE, todayMadrid } from '@/lib/dates';
import { intlLocale, type TranslationKey } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.today') };
}

const SHORTCUTS: { href: Route; icon: LucideIcon; title: TranslationKey; hint: TranslationKey }[] =
  [
    { href: '/escuchar', icon: Headphones, title: 'today.listenCta', hint: 'today.listenHint' },
    { href: '/leer', icon: BookOpen, title: 'today.readCta', hint: 'today.readHint' },
    { href: '/repasar', icon: Layers, title: 'today.reviewCta', hint: 'today.reviewHint' },
    { href: '/diario', icon: NotebookPen, title: 'today.journalCta', hint: 'today.journalHint' },
  ];

export default async function TodayPage() {
  const today = todayMadrid();
  const [t, locale, profile, ratings, minutes] = await Promise.all([
    getT(),
    getLocale(),
    getProfile(),
    getSkillRatings(),
    getMinutesOn(today),
  ]);

  const done = Math.round(minutes);
  const goal = profile.dailyGoalMin;
  const dateLabel = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: APP_TIME_ZONE,
  }).format(new Date());

  return (
    <PageContainer>
      <PageHeader
        title={t('today.title')}
        subtitle={<span className="first-letter:uppercase">{dateLabel}</span>}
      />

      <Panel className="flex items-center gap-5">
        <RingProgress value={done} max={goal} label={t('today.goalRing', { done, goal })}>
          <span className="hud text-xl font-medium">{done}</span>
        </RingProgress>
        <div className="min-w-0">
          <PanelTitle>{t('today.goal', { min: goal })}</PanelTitle>
          <p className="hud mt-1 text-2xl">{t('today.goalProgress', { done, goal })}</p>
          {done >= goal ? <p className="mt-1 text-sm text-success">{t('today.goalMet')}</p> : null}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>{t('journal.quickTitle')}</PanelTitle>
        <p className="mt-2 mb-4 text-sm text-muted">{t('journal.quickHint')}</p>
        <QuickLog />
      </Panel>

      <Panel>
        <PanelTitle>{t('today.planTitle')}</PanelTitle>
        <p className="mt-2 text-sm text-muted">{t('today.planPending')}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SHORTCUTS.map(({ href, icon: Icon, title, hint }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full items-center gap-3 rounded-control border border-border bg-surface-2 p-3 transition-colors duration-150 hover:border-accent"
              >
                <Icon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-accent"
                  strokeWidth={1.75}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{t(title)}</span>
                  <span className="block text-sm text-muted">{t(hint)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelTitle>{t('today.levelsTitle')}</PanelTitle>
        <div className="mt-4 flex flex-col gap-5">
          <LevelMeter rating={ratings.listening} t={t} />
          <LevelMeter rating={ratings.reading} t={t} />
        </div>
      </Panel>
    </PageContainer>
  );
}
