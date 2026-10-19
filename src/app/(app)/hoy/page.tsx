import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageContainer, PageHeader, PageSections } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { RingProgress } from '@/components/ui/ring-progress';
import { QuickLog } from '@/features/journal/components/quick-log';
import { LevelMeter } from '@/features/level/components/level-meter';
import { getSkillRatings } from '@/features/level/server/queries';
import { TODAY_SHORTCUTS } from '@/features/today/lib/shortcuts';
import { getToday } from '@/features/today/server/today';
import { getSessionOrRedirect } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.today') };
}

// La portada enseña una copia de esta pantalla dentro del portátil (src/features/today/lib/preview.ts):
// lo que cambie aquí, cámbialo también allí.
export default async function TodayPage() {
  await getSessionOrRedirect();
  const [{ t, level, done, goal, dateLabel, reviewHint }, ratings] = await Promise.all([
    getToday(),
    getSkillRatings(),
  ]);
  // Lo primero es saber el nivel: de él depende lo que se enseña en cada sección.
  if (!level) redirect('/nivel');

  return (
    <PageContainer>
      <PageHeader
        title={t('today.title')}
        subtitle={<span className="first-letter:uppercase">{dateLabel}</span>}
        actions={
          <Link
            href="/nivel"
            aria-label={`${t('today.yourLevel', { level })}. ${t('today.changeLevel')}`}
            className="btn btn-ghost tabular-nums"
          >
            {t('today.yourLevel', { level })}
          </Link>
        }
      />

      <PageSections>
        <Panel className="flex items-center gap-5">
          <RingProgress value={done} max={goal} label={t('today.goalRing', { done, goal })}>
            <span className="tabular-nums text-subheading font-medium">{done}</span>
          </RingProgress>
          <div className="min-w-0">
            <PanelTitle>{t('today.goal', { min: goal })}</PanelTitle>
            <p className="tabular-nums mt-1 text-heading-sm">
              {t('today.goalProgress', { done, goal })}
            </p>
            {done >= goal ? (
              <p className="mt-1 text-body-sm text-success">{t('today.goalMet')}</p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelTitle>{t('journal.quickTitle')}</PanelTitle>
          <p className="mt-2 mb-4 text-body-sm text-muted">{t('journal.quickHint')}</p>
          <QuickLog />
        </Panel>

        <Panel>
          <PanelTitle>{t('today.planTitle')}</PanelTitle>
          <p className="mt-2 text-body-sm text-muted">{t('today.planPending')}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TODAY_SHORTCUTS.map(({ href, icon: Icon, title, hint }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-full items-center gap-3 rounded-card border border-transparent bg-surface-2 p-4 transition-colors duration-150 hover:border-border"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 shrink-0 text-accent-text"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{t(title)}</span>
                    <span className="block text-body-sm text-muted">
                      {hint ? t(hint) : reviewHint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle>{t('today.levelsTitle')}</PanelTitle>
          <div className="mt-6 flex flex-col gap-6">
            <LevelMeter rating={ratings.listening} t={t} />
            <LevelMeter rating={ratings.reading} t={t} />
          </div>
        </Panel>
      </PageSections>
    </PageContainer>
  );
}
