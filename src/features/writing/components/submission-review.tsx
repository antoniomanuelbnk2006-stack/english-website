'use client';

import { TriangleAlert } from 'lucide-react';
import { Tabs } from 'radix-ui';
import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/panel';
import { AiFeedback } from '@/features/writing/components/ai-feedback';
import { CardsOffer } from '@/features/writing/components/cards-offer';
import { MarkedText } from '@/features/writing/components/marked-text';
import { RewritePanel } from '@/features/writing/components/rewrite-panel';
import { SelfReview } from '@/features/writing/components/self-review';
import type { SelfReview as Review } from '@/features/writing/lib/checks';
import { locate } from '@/features/writing/lib/highlight';
import type { Level, Scores, WritingFeedback } from '@/features/writing/lib/schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export type ReviewResult =
  | { kind: 'ai'; feedback: WritingFeedback }
  | { kind: 'self'; review: Review; scores: Scores | null; points: boolean[] };

export interface SubmissionReviewProps {
  submissionId: string;
  text: string;
  targetLevel: Level;
  /** Los puntos que pedía la consigna (vacío si la consigna ya no existe). */
  points: readonly string[];
  result: ReviewResult;
  /** La respuesta modelo; `null` si la consigna ya no existe. */
  modelAnswer: string | null;
  cards: readonly { front: string; back: string }[];
  rewriteText: string | null;
  fichas: Record<string, string>;
  /** La corrección no se ha podido guardar en el historial. */
  notSaved?: boolean;
  /** Acciones del final (otra vez, historial…). */
  footer?: ReactNode;
}

const tab =
  'min-h-11 rounded-pill text-body-sm font-medium text-muted transition-colors duration-150 data-[state=active]:bg-surface-2 data-[state=active]:text-accent-text';
// En pantallas anchas las dos columnas se ven a la vez; en el móvil, la de la pestaña activa.
const column =
  'flex min-w-0 flex-col gap-6 data-[state=inactive]:hidden lg:data-[state=inactive]:flex';

/**
 * Una entrega con su corrección: el texto (con lo corregido resaltado) y la reescritura a un
 * lado, y el feedback al otro. En el móvil son dos pestañas (pantallas y flujos §2.7).
 */
export function SubmissionReview({
  submissionId,
  text,
  targetLevel,
  points,
  result,
  modelAnswer,
  cards,
  rewriteText,
  fichas,
  notSaved = false,
  footer,
}: SubmissionReviewProps) {
  const t = useT();

  const spans =
    result.kind === 'ai'
      ? locate(
          text,
          result.feedback.corrections.map((correction) => correction.original),
        )
      : result.review.hints
          .filter((hint) => hint.severity !== 'check')
          .map((hint) => ({ start: hint.start, end: hint.end }));

  return (
    <div className="flex flex-col gap-6">
      {notSaved ? (
        <p role="alert" data-tone="warning" className="feedback">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {t('writing.notSaved')}
        </p>
      ) : null}

      <Tabs.Root defaultValue="feedback" className="flex flex-col gap-4">
        <Tabs.List className="grid grid-cols-2 gap-1 rounded-pill bg-surface p-1 lg:hidden">
          <Tabs.Trigger value="text" className={tab}>
            {t('writing.tabText')}
          </Tabs.Trigger>
          <Tabs.Trigger value="feedback" className={tab}>
            {t('writing.tabFeedback')}
          </Tabs.Trigger>
        </Tabs.List>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Tabs.Content value="text" forceMount className={column}>
            <Panel className="flex flex-col gap-3">
              <h2 className="text-subheading">{t('writing.yourText')}</h2>
              <MarkedText text={text} spans={spans} />
            </Panel>
            <Panel>
              <RewritePanel submissionId={submissionId} original={text} saved={rewriteText} />
            </Panel>
          </Tabs.Content>

          <Tabs.Content value="feedback" forceMount className={column}>
            <Panel className="flex flex-col gap-4">
              <h2 className="text-subheading">
                {t(result.kind === 'ai' ? 'writing.resultAi' : 'writing.resultSelf')}
              </h2>
              {result.kind === 'ai' ? (
                <AiFeedback feedback={result.feedback} targetLevel={targetLevel} fichas={fichas} />
              ) : (
                <SelfReview
                  submissionId={submissionId}
                  review={result.review}
                  points={points}
                  initial={{ scores: result.scores, points: result.points }}
                  fichas={fichas}
                />
              )}
            </Panel>

            {modelAnswer ? (
              <Panel>
                <details>
                  <summary className="cursor-pointer text-body-lg font-medium">
                    {t('writing.modelTitle')}
                  </summary>
                  <p className="mt-2 text-body-sm text-muted">{t('writing.modelHint')}</p>
                  <p lang="en" className="prose-reading mt-3 whitespace-pre-wrap">
                    {modelAnswer}
                  </p>
                </details>
              </Panel>
            ) : null}

            {cards.length > 0 ? (
              <Panel>
                <CardsOffer submissionId={submissionId} cards={cards} />
              </Panel>
            ) : null}
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {footer ? <div className={cn('flex flex-wrap gap-2')}>{footer}</div> : null}
    </div>
  );
}
