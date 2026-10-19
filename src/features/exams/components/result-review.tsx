import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/panel';
import type { ExamItemResult, ExamResult } from '@/features/exams/lib/grade';
import { BAND_LABEL, sectionLabel } from '@/features/exams/lib/labels';
import { splitCloze } from '@/features/use-of-english/lib/grade';
import type { ExamFormat } from '@/lib/content/exam-formats';
import {
  partRecordings,
  type ExamPart,
  type ExamRecording,
  type QuestionPaper,
} from '@/lib/content/exam-schema';
import { contentLang } from '@/lib/content/language';
import type { Translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { WritingReview } from './writing-review';

const paragraphs = (text: string) => text.split(/\n{2,}/).filter((piece) => piece.trim() !== '');

function Mark({ item, t }: { item: ExamItemResult; t: Translate }) {
  const Icon = item.correct ? CircleCheck : item.marks > 0 ? TriangleAlert : CircleX;
  const color = item.correct ? 'text-success' : item.marks > 0 ? 'text-warning' : 'text-error';
  const label = item.correct
    ? t('tasks.correct')
    : item.marks > 0
      ? t('uoe.halfRight')
      : t('tasks.incorrect');
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', color)}>
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
      {label}
    </span>
  );
}

/** El texto de una parte con cada hueco ya resuelto, para releerlo con la solución puesta. */
function Solved({ text, fill, lang }: { text: string; fill: (n: number) => string; lang: string }) {
  return (
    <>
      {paragraphs(text).map((paragraph, index) => (
        <p key={index} lang={lang} className="prose-reading whitespace-pre-line">
          {splitCloze(paragraph).map((piece, pieceIndex) =>
            typeof piece === 'string' ? (
              <span key={pieceIndex}>{piece}</span>
            ) : (
              <strong key={pieceIndex} className="font-medium text-accent-text">
                <span className="tabular-nums text-caption">({piece})</span> {fill(piece)}
              </strong>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="rounded-card bg-surface-2">
      <summary className="cursor-pointer px-3 py-2 text-body-sm font-medium text-muted hover:text-text">
        {summary}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-3 py-3">{children}</div>
    </details>
  );
}

function Transcript({ recording, lang }: { recording: ExamRecording; lang: string }) {
  const names = new Map(recording.speakers.map((speaker) => [speaker.id, speaker.name]));
  const several = recording.speakers.length > 1;
  return (
    <div className="flex flex-col gap-2">
      {recording.segments.map((segment, index) => (
        <p key={index} lang={lang} className="prose-reading">
          {several ? (
            <span className="tabular-nums mr-2 text-caption text-muted">
              {names.get(segment.speaker)}
            </span>
          ) : null}
          {segment.text}
        </p>
      ))}
    </div>
  );
}

/** El material de una parte, ya corregida: el texto con la solución y, en Listening, el guion. */
function Material({ part, t, lang }: { part: ExamPart; t: Translate; lang: string }) {
  const recordings = partRecordings(part);
  const transcripts =
    recordings.length > 0 ? (
      <Fold summary={t('exams.seeTranscript')}>
        {recordings.map((recording, index) => (
          <div key={recording.id} className="flex flex-col gap-2">
            {recordings.length > 1 ? (
              <h5 className="tabular-nums text-caption text-muted">
                {t('exams.recording', { n: index + 1 })}
              </h5>
            ) : null}
            <Transcript recording={recording} lang={lang} />
          </div>
        ))}
      </Fold>
    ) : null;

  switch (part.type) {
    case 'mcq': {
      const texts = part.groups.flatMap((group) => (group.text ? [group.text] : []));
      return (
        <>
          {texts.length > 0 ? (
            <Fold summary={t('exams.seeText')}>
              {texts.map((text, index) => (
                <div key={index} className="flex flex-col gap-3">
                  {paragraphs(text).map((paragraph, paragraphIndex) => (
                    <p
                      key={paragraphIndex}
                      lang={lang}
                      className="prose-reading whitespace-pre-line"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </Fold>
          ) : null}
          {transcripts}
        </>
      );
    }
    case 'mcq_cloze':
      return (
        <Fold summary={t('exams.seeSolvedText')}>
          <Solved
            lang={lang}
            text={part.text}
            fill={(n) => {
              const gap = part.gaps.find((item) => item.n === n);
              return gap?.options[gap.answer] ?? '';
            }}
          />
        </Fold>
      );
    case 'open_cloze':
    case 'word_formation':
      return (
        <Fold summary={t('exams.seeSolvedText')}>
          <Solved
            lang={lang}
            text={part.text}
            fill={(n) => part.gaps.find((gap) => gap.n === n)?.accept[0] ?? ''}
          />
        </Fold>
      );
    case 'completion':
      return (
        <>
          <Fold summary={t('exams.seeSolvedText')}>
            <Solved
              lang={lang}
              text={part.text.replace(/\n/g, '\n\n')}
              fill={(n) => part.gaps.find((gap) => gap.n === n)?.accept[0] ?? ''}
            />
          </Fold>
          {transcripts}
        </>
      );
    case 'gapped_text':
      return (
        <Fold summary={t('exams.seeSolvedText')}>
          <Solved
            lang={lang}
            text={part.text}
            fill={(n) => {
              const answer = part.gaps.find((gap) => gap.n === n)?.answer;
              return part.options.find((option) => option.id === answer)?.text ?? '';
            }}
          />
        </Fold>
      );
    case 'matching': {
      const long = part.tasks.some((task) =>
        task.options.some((option) => option.text.length > 160),
      );
      return (
        <>
          {long ? (
            <Fold summary={t('exams.seeText')}>
              {part.tasks.flatMap((task) =>
                task.options.map((option) => (
                  <div key={option.id} className="flex flex-col gap-2">
                    <h5 className="flex items-baseline gap-2">
                      <span className="tabular-nums font-medium text-accent-text">{option.id}</span>
                      {option.title ? <span lang={lang}>{option.title}</span> : null}
                    </h5>
                    {paragraphs(option.text).map((paragraph, index) => (
                      <p key={index} lang={lang} className="prose-reading">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )),
              )}
            </Fold>
          ) : null}
          {transcripts}
        </>
      );
    }
    default:
      return null;
  }
}

/** Enunciado de una pregunta para la corrección («You hear…», la frase a transformar…). */
function promptOf(part: ExamPart, n: number): string | null {
  switch (part.type) {
    case 'mcq':
      for (const group of part.groups) {
        const question = group.questions.find((item) => item.n === n);
        if (question) return question.prompt ?? group.text ?? null;
      }
      return null;
    case 'matching':
      for (const task of part.tasks) {
        const question = task.questions.find((item) => item.n === n);
        if (question) return question.prompt;
      }
      return null;
    case 'key_word_transformation': {
      const item = part.items.find((entry) => entry.n === n);
      return item ? `${item.original} → ${item.before} … ${item.after} (${item.keyword})` : null;
    }
    default:
      return null;
  }
}

/**
 * La corrección de una prueba entregada: nota por sección (con la escala Cambridge orientativa),
 * puntos por parte y cada pregunta con su respuesta, la correcta y la explicación.
 */
export function ResultReview({
  paper,
  format,
  result,
  t,
}: {
  paper: QuestionPaper;
  format: ExamFormat;
  result: ExamResult;
  t: Translate;
}) {
  const lang = contentLang(paper.id);
  const dele = format.system === 'dele';
  return (
    <div className="flex flex-col gap-6">
      <Panel className="flex flex-col gap-4">
        <p className="tabular-nums text-heading-sm">
          {t('uoe.score', {
            marks: result.marks,
            total: result.total,
            pct: Math.round(result.score * 100),
          })}
        </p>
        <ul className="flex flex-col gap-3">
          {result.sections.map((section) => (
            <li key={section.section} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span lang={dele ? undefined : 'en'} className="font-medium">
                  {t(sectionLabel(section.section, format.system))}
                </span>
                <span className="tabular-nums text-body-sm text-muted">
                  {t('exams.marksOf', { marks: section.marks, total: section.total })}
                </span>
                {section.scale !== null ? (
                  <span className="tabular-nums text-body-sm">
                    {t('exams.scaleLine', { scale: section.scale })}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'text-body-sm font-medium',
                  section.passed ? 'text-success' : 'text-warning',
                )}
              >
                {section.band
                  ? t(BAND_LABEL[section.band])
                  : t(section.passed ? 'exams.passPlain' : 'exams.failPlain')}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-muted">
          {format.pass !== null
            ? t('exams.scaleNote', { exam: format.exam, pass: format.pass })
            : t(dele ? 'exams.officialNoteDele' : 'exams.plainNote')}
        </p>
      </Panel>

      {paper.parts.map((part, index) => {
        const graded = result.parts.find((item) => item.part === index + 1);
        const name = format[paper.paper].parts[index]?.name ?? '';
        return (
          <section key={index} aria-labelledby={`part-${index}`} className="flex flex-col gap-3">
            <h2
              id={`part-${index}`}
              className="flex flex-wrap items-baseline gap-x-3 text-body-lg font-semibold"
            >
              {t('exams.part', { n: index + 1 })}
              <span lang={lang} className="font-normal text-muted">
                {name}
              </span>
              {graded ? (
                <span className="tabular-nums ml-auto text-body-sm text-muted">
                  {t('exams.marksOf', { marks: graded.marks, total: graded.total })}
                </span>
              ) : null}
            </h2>

            {part.type === 'writing' ? (
              <div className="flex flex-col gap-3">
                <p lang={lang} className="prose-reading whitespace-pre-line">
                  {part.prompt}
                </p>
                <WritingReview paperId={paper.id} n={part.n} />
                <div className="flex flex-col gap-1">
                  <h4 className="text-body-sm font-medium text-muted">{t('exams.writingModel')}</h4>
                  <p lang={lang} className="prose-reading whitespace-pre-line">
                    {part.model_answer}
                  </p>
                </div>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-muted">
                  {part.checklist_es.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <Material part={part} t={t} lang={lang} />
                <ol className="flex flex-col gap-3">
                  {graded?.items.map((item) => {
                    const prompt = promptOf(part, item.n);
                    return (
                      <li key={item.n} className="flex flex-col gap-1 text-body-sm">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="tabular-nums text-muted">{item.n}.</span>
                          <Mark item={item} t={t} />
                          {item.max > 1 ? (
                            <span className="tabular-nums text-muted">
                              {t('uoe.marksOf', { marks: item.marks, max: item.max })}
                            </span>
                          ) : null}
                        </span>
                        {prompt ? (
                          <span lang={lang} className="line-clamp-3 text-muted">
                            {prompt}
                          </span>
                        ) : null}
                        {!item.correct ? (
                          <span className="text-muted">
                            {t('tasks.yourAnswer')}:{' '}
                            {item.given === '' ? (
                              t('uoe.blank')
                            ) : (
                              <span lang={lang} className="text-text">
                                {item.given}
                              </span>
                            )}
                          </span>
                        ) : null}
                        <span>
                          {t('tasks.correctAnswer')}:{' '}
                          <span lang={lang} className="font-medium">
                            {item.answer}
                          </span>
                        </span>
                        {item.note ? (
                          <span className="text-warning">
                            {t(
                              item.note === 'word_limit' ? 'uoe.noteWordLimit' : 'uoe.noteKeyword',
                            )}
                          </span>
                        ) : null}
                        <span className="text-muted">{item.explanation_es}</span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
