import { BookOpen, ExternalLink, Headphones, NotebookPen } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { Chip, Panel, PanelTitle } from '@/components/ui/panel';
import { DeleteEntry } from '@/features/journal/components/delete-entry';
import { JournalForm } from '@/features/journal/components/journal-form';
import { QuickLog } from '@/features/journal/components/quick-log';
import {
  groupByDay,
  isListening,
  splitMinutes,
  weekTotals,
  type InputKind,
} from '@/features/journal/lib/journal';
import { getRecentEntries } from '@/features/journal/server/queries';
import { todayMadrid } from '@/lib/dates';
import { intlLocale, type Translate, type TranslationKey } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.journal') };
}

const KIND_LABEL: Record<InputKind, TranslationKey> = {
  intensive_listening: 'journal.kindIntensiveListening',
  extensive_listening: 'journal.kindExtensiveListening',
  intensive_reading: 'journal.kindIntensiveReading',
  extensive_reading: 'journal.kindExtensiveReading',
};

function duration(t: Translate, minutes: number): string {
  const { h, m } = splitMinutes(minutes);
  return h > 0 ? t('journal.hoursMinutes', { h, m }) : t('journal.onlyMinutes', { m });
}

export default async function JournalPage() {
  const [t, locale, entries] = await Promise.all([getT(), getLocale(), getRecentEntries()]);
  const today = todayMadrid();
  const week = weekTotals(entries, today);
  const days = groupByDay(entries);
  const formatDay = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  return (
    <PageContainer>
      <PageHeader title={t('journal.title')} subtitle={t('journal.subtitle')} />

      <Panel>
        <PanelTitle>{t('journal.quickTitle')}</PanelTitle>
        <p className="mt-2 mb-4 text-sm text-muted">{t('journal.quickHint')}</p>
        <QuickLog />
      </Panel>

      <Panel>
        <PanelTitle>{t('journal.weekTitle')}</PanelTitle>
        <dl className="mt-3 grid grid-cols-3 gap-4">
          {(
            [
              ['journal.weekListening', week.listening],
              ['journal.weekReading', week.reading],
              ['journal.weekTotal', week.total],
            ] as const
          ).map(([label, minutes]) => (
            <div key={label}>
              <dt className="text-sm text-muted">{t(label)}</dt>
              <dd className="hud text-xl">{duration(t, minutes)}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <details>
          <summary className="cursor-pointer text-xs font-medium tracking-widest text-muted uppercase">
            {t('journal.detailsTitle')}
          </summary>
          <div className="mt-4">
            <JournalForm />
          </div>
        </details>
      </Panel>

      <section aria-labelledby="journal-entries" className="flex flex-col gap-4">
        <PanelTitle id="journal-entries">{t('journal.entriesTitle')}</PanelTitle>
        {days.length === 0 ? (
          <EmptyState icon={NotebookPen} title={t('journal.emptyTitle')}>
            {t('journal.emptyBody')}
          </EmptyState>
        ) : (
          days.map((group) => (
            <div key={group.day}>
              <h3 className="mb-2 text-sm font-medium first-letter:uppercase">
                {formatDay.format(new Date(`${group.day}T00:00:00Z`))}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => {
                  const Icon = isListening(entry.kind) ? Headphones : BookOpen;
                  const title = entry.title ?? t(KIND_LABEL[entry.kind]);
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-5 shrink-0 text-accent"
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {entry.url ? (
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 hover:text-accent"
                            >
                              {title}
                              <ExternalLink
                                aria-hidden="true"
                                className="size-3.5"
                                strokeWidth={1.75}
                              />
                            </a>
                          ) : (
                            title
                          )}
                        </p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {entry.title ? <span>{t(KIND_LABEL[entry.kind])}</span> : null}
                          <span>
                            {t(
                              entry.source === 'app'
                                ? 'journal.sourceApp'
                                : 'journal.sourceExternal',
                            )}
                          </span>
                          {entry.perceivedLevel ? (
                            <Chip className="hud h-5 px-2">{entry.perceivedLevel}</Chip>
                          ) : null}
                          {entry.words ? (
                            <span className="hud">{t('lesson.words', { n: entry.words })}</span>
                          ) : null}
                        </p>
                      </div>
                      <span className="hud shrink-0 text-sm">{duration(t, entry.minutes)}</span>
                      {entry.source === 'external' ? (
                        <DeleteEntry id={entry.id} label={t('journal.delete', { title })} />
                      ) : (
                        <span aria-hidden="true" className="size-11 shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </PageContainer>
  );
}
