import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/ui/page';
import { Chip, Panel, PanelTitle } from '@/components/ui/panel';
import { MarkSeen } from '@/features/grammar/components/mark-seen';
import { fichaComponents } from '@/features/grammar/components/mdx';
import { Practice } from '@/features/grammar/components/practice';
import { getSessionOrRedirect } from '@/lib/auth';
import { compileFicha, findFicha, lessonsWithGrammar } from '@/lib/content/grammar';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata({
  params,
}: PageProps<'/gramatica/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findFicha(id)?.meta.title };
}

export default async function FichaPage({ params }: PageProps<'/gramatica/[id]'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  const ficha = findFicha(id);
  const Content = ficha ? await compileFicha(id) : null;
  if (!ficha || !Content) notFound();

  const t = await getT();
  const { meta } = ficha;
  const lessons = lessonsWithGrammar(meta.id);
  const related = meta.related.flatMap((other) => {
    const found = findFicha(other);
    return found ? [found.meta] : [];
  });

  return (
    <PageContainer width="exercise">
      <MarkSeen grammarId={meta.id} />
      <header className="flex flex-col gap-3">
        <Link
          href="/gramatica"
          className="flex items-center gap-1.5 self-start rounded-structure text-body-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('grammar.back')}
        </Link>
        <h1 lang="en" className="text-heading-sm sm:text-heading">
          {meta.title}
        </h1>
        <p className="text-muted">{meta.summary_es}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip className="tabular-nums">{meta.level}</Chip>
          {meta.skills.map((skill) => (
            <Chip key={skill}>{t(`skills.${skill}` as TranslationKey)}</Chip>
          ))}
        </div>
      </header>

      <Panel>
        <Content components={fichaComponents(t('grammar.tableLabel'))} />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <PanelTitle>{t('grammar.examples')}</PanelTitle>
        <ul className="flex flex-col gap-3">
          {meta.examples.map((example) => (
            <li key={example.en} className="flex flex-col gap-0.5">
              <span lang="en" className="prose-reading">
                {example.en}
              </span>
              <span className="text-body-sm text-muted">{example.es}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <div>
          <PanelTitle>{t('grammar.practice')}</PanelTitle>
          <p className="mt-2 text-body-sm text-muted">{t('grammar.practiceHint')}</p>
        </div>
        <Practice
          grammarId={meta.id}
          // Las respuestas se quedan en el servidor: aquí solo viajan los enunciados.
          items={meta.practice.map(({ id: itemId, prompt }) => ({ id: itemId, prompt }))}
        />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <PanelTitle>{t('grammar.whereItAppears')}</PanelTitle>
        {lessons.length === 0 ? (
          <p className="text-body-sm text-muted">{t('grammar.noLessonsYet')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={
                    `${lesson.skill === 'listening' ? '/escuchar' : '/leer'}/${lesson.id}` as Route
                  }
                  className="text-accent-text underline underline-offset-4"
                >
                  <span lang="en">{lesson.title}</span>
                </Link>{' '}
                <span className="text-body-sm text-muted">
                  · {t(`skills.${lesson.skill}` as TranslationKey)} · {lesson.level}
                </span>
              </li>
            ))}
          </ul>
        )}
        {related.length > 0 ? (
          <>
            <PanelTitle className="mt-2">{t('grammar.related')}</PanelTitle>
            <ul className="flex flex-col gap-1.5">
              {related.map((other) => (
                <li key={other.id}>
                  <Link
                    href={`/gramatica/${other.id}` as Route}
                    lang="en"
                    className="text-accent-text underline underline-offset-4"
                  >
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Panel>
    </PageContainer>
  );
}
