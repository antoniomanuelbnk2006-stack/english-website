import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { EmptyState, PageContainer, PageHeader, PageSections } from '@/components/ui/page';
import { Chip, PanelTitle } from '@/components/ui/panel';
import { fichaState, type FichaState } from '@/features/grammar/lib/practice';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { getProgressByLesson } from '@/features/lessons/server/queries';
import { getUserLevel } from '@/features/lexicon/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { getGrammarIndex } from '@/lib/content/grammar';
import type { TranslationKey } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { contentLang } from '@/lib/content/language';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.grammar') };
}

const STATE: Record<FichaState, { icon: LucideIcon; label: TranslationKey; className: string }> = {
  new: { icon: Circle, label: 'grammar.stateNew', className: 'text-muted' },
  seen: { icon: CircleDashed, label: 'grammar.stateSeen', className: 'text-muted' },
  practiced: { icon: CircleDot, label: 'grammar.statePracticed', className: 'text-warning' },
  mastered: { icon: CircleCheck, label: 'grammar.stateMastered', className: 'text-success' },
};

export default async function GrammarPage() {
  await getSessionOrRedirect();
  const t = await getT();
  const fichas = getGrammarIndex(await getLocale(), await getPracticeLanguage());

  if (fichas.length === 0) {
    return (
      <PageContainer>
        <PageHeader title={t('nav.grammar')} subtitle={t('grammar.subtitle')} />
        <EmptyState icon={Shapes} title={t('grammar.emptyTitle')}>
          {t('grammar.emptyBody')}
        </EmptyState>
      </PageContainer>
    );
  }

  const [progress, userLevel] = await Promise.all([getProgressByLesson(), getUserLevel()]);
  // Primero las fichas de tu nivel; después, el resto en orden.
  const levels = CEFR_LEVELS.filter((level) => fichas.some((ficha) => ficha.level === level)).sort(
    (a, b) => Number(b === userLevel) - Number(a === userLevel),
  );

  return (
    <PageContainer>
      <PageHeader title={t('nav.grammar')} subtitle={t('grammar.subtitle')} />
      <PageSections>
        {levels.map((level) => (
          <section key={level} aria-labelledby={`grammar-${level}`}>
            <PanelTitle id={`grammar-${level}`} className="mb-6">
              {t('grammar.levelTitle', { level })}
            </PanelTitle>
            <ul className="grid gap-4 sm:grid-cols-2">
              {fichas
                .filter((ficha) => ficha.level === level)
                .map((ficha) => {
                  const {
                    icon: Icon,
                    label,
                    className,
                  } = STATE[fichaState(progress.get(ficha.id))];
                  return (
                    <li key={ficha.id}>
                      <Link
                        href={`/gramatica/${ficha.id}` as Route}
                        className="card flex h-full flex-col gap-3 border border-transparent transition-colors duration-150 hover:border-border"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3
                            lang={contentLang(ficha.id)}
                            className="text-body-lg leading-snug font-medium"
                          >
                            {ficha.title}
                          </h3>
                          <span
                            className={cn(
                              'flex shrink-0 items-center gap-1.5 text-caption',
                              className,
                            )}
                          >
                            <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                            {t(label)}
                          </span>
                        </div>
                        <p className="text-body-sm text-muted">{ficha.summary_es}</p>
                        <div className="mt-auto flex flex-wrap gap-1.5">
                          <Chip className="tabular-nums">{ficha.level}</Chip>
                          {ficha.skills.map((skill) => (
                            <Chip key={skill}>{t(`skills.${skill}` as TranslationKey)}</Chip>
                          ))}
                        </div>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </PageSections>
    </PageContainer>
  );
}
