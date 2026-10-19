'use client';

import type { ReactNode } from 'react';
import { useContentLang } from '@/components/content-language';
import { fieldClasses } from '@/components/ui/input';
import { splitCloze } from '@/features/use-of-english/lib/grade';
import type { PartFormat } from '@/lib/content/exam-formats';
import type { PublicExamPart } from '@/lib/content/exam-schema';
import { countExamWords } from '@/lib/content/uoe-schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export type Answers = Readonly<Record<number, string | number>>;

interface Common {
  answers: Answers;
  onAnswer: (n: number, value: string | number) => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

const inlineField = cn(
  fieldClasses,
  'mx-1 inline-block h-9 w-32 px-2 align-baseline text-body pointer-coarse:h-11',
);

const paragraphs = (text: string) => text.split(/\n{2,}/).filter((piece) => piece.trim() !== '');

function GapNumber({ n }: { n: number }) {
  return (
    <span lang="es" className="tabular-nums text-caption text-muted">
      ({n})
    </span>
  );
}

/** Un texto con huecos: cada `{{n}}` se cambia por lo que devuelva `field`. */
function GappedProse({ text, field }: { text: string; field: (n: number) => ReactNode }) {
  const lang = useContentLang();
  return (
    <>
      {paragraphs(text).map((paragraph, index) => (
        <p key={index} lang={lang} className="prose-reading leading-[2.75rem]">
          {splitCloze(paragraph).map((piece, pieceIndex) =>
            typeof piece === 'string' ? (
              <span key={pieceIndex}>{piece}</span>
            ) : (
              <span key={pieceIndex} className="whitespace-nowrap">
                <GapNumber n={piece} />
                {field(piece)}
              </span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function Prose({ text }: { text: string }) {
  const lang = useContentLang();
  return (
    <>
      {paragraphs(text).map((paragraph, index) => (
        <p key={index} lang={lang} className="prose-reading whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </>
  );
}

function TextBox({ title, children }: { title?: string; children: ReactNode }) {
  const lang = useContentLang();
  return (
    <div className="card flex flex-col gap-3">
      {title ? (
        <h3 lang={lang} className="text-body-lg font-medium">
          {title}
        </h3>
      ) : null}
      {children}
    </div>
  );
}

function ChoiceQuestion({
  question,
  answers,
  onAnswer,
}: Common & { question: { n: number; prompt?: string; options: string[] } }) {
  const lang = useContentLang();
  const t = useT();
  const chosen = answers[question.n];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex gap-2">
        <span className="tabular-nums shrink-0 text-body-sm text-muted">{question.n}.</span>
        <span lang={lang} className="font-medium">
          {question.prompt ?? <span lang="es">{t('exams.chooseMeaning')}</span>}
        </span>
      </legend>
      {question.options.map((option, index) => (
        <label
          key={index}
          className={cn('option cursor-pointer items-start', chosen === index && 'border-accent')}
        >
          <input
            type="radio"
            name={`q${question.n}`}
            checked={chosen === index}
            onChange={() => onAnswer(question.n, index)}
            className="mt-1 size-4 shrink-0 accent-accent"
          />
          <span aria-hidden="true" className="tabular-nums mt-0.5 text-caption text-muted">
            {LETTERS[index]}
          </span>
          <span lang={lang} className="min-w-0 flex-1">
            {option}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Desplegable de letras (A–H) para emparejar o para devolver una frase a su hueco. */
function LetterSelect({
  n,
  ids,
  inline,
  answers,
  onAnswer,
}: Common & { n: number; ids: readonly string[]; inline?: boolean }) {
  const t = useT();
  const value = answers[n];
  return (
    <select
      aria-label={t('exams.question', { n })}
      className={cn(
        inline ? inlineField : cn(fieldClasses, 'h-9 pointer-coarse:h-11'),
        'w-20 pr-7',
      )}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onAnswer(n, event.target.value)}
    >
      <option value="">{t('tasks.choose')}</option>
      {ids.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );
}

function TextGap({ n, wide, answers, onAnswer }: Common & { n: number; wide?: boolean }) {
  const lang = useContentLang();
  const t = useT();
  return (
    <input
      type="text"
      lang={lang}
      aria-label={t('exams.question', { n })}
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      className={cn(inlineField, wide ? 'w-44' : 'w-28')}
      value={String(answers[n] ?? '')}
      onChange={(event) => onAnswer(n, event.target.value)}
    />
  );
}

/**
 * Una parte de la prueba, tal como la ve el candidato: el texto (si lo hay) y sus preguntas.
 * Aquí no hay respuestas ni correcciones: eso llega del servidor al entregar.
 */
export function PartView({
  part,
  format,
  answers,
  onAnswer,
}: Common & { part: PublicExamPart; format: PartFormat }) {
  const lang = useContentLang();
  const t = useT();
  const common = { answers, onAnswer };

  switch (part.type) {
    case 'mcq': {
      const single = part.groups.length === 1 ? part.groups[0] : undefined;
      // Un texto largo con varias preguntas: texto a un lado y preguntas al otro.
      if (single?.text) {
        return (
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="xl:sticky xl:top-52 xl:max-h-[calc(100dvh-14rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
              <TextBox title={part.title}>
                <Prose text={single.text} />
              </TextBox>
            </div>
            <div className="flex flex-col gap-6">
              {single.questions.map((question) => (
                <ChoiceQuestion key={question.n} question={question} {...common} />
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-6">
          {part.groups.map((group, index) => (
            <div key={index} className="flex flex-col gap-4">
              {group.context ? (
                <p lang={lang} className="text-body-sm text-muted">
                  {group.context}
                </p>
              ) : null}
              {group.text ? (
                <TextBox>
                  <Prose text={group.text} />
                </TextBox>
              ) : null}
              {group.questions.map((question) => (
                <ChoiceQuestion key={question.n} question={question} {...common} />
              ))}
            </div>
          ))}
        </div>
      );
    }

    case 'mcq_cloze':
      return (
        <TextBox title={part.title}>
          <GappedProse
            text={part.text}
            field={(n) => {
              const options = part.gaps.find((gap) => gap.n === n)?.options ?? [];
              const chosen = answers[n];
              return (
                <select
                  lang={lang}
                  aria-label={t('exams.question', { n })}
                  className={cn(inlineField, 'w-auto pr-7')}
                  value={typeof chosen === 'number' ? String(chosen) : ''}
                  onChange={(event) =>
                    onAnswer(n, event.target.value === '' ? '' : Number(event.target.value))
                  }
                >
                  <option value="">{t('tasks.choose')}</option>
                  {options.map((option, index) => (
                    <option key={index} value={index}>
                      {LETTERS[index]}. {option}
                    </option>
                  ))}
                </select>
              );
            }}
          />
        </TextBox>
      );

    case 'open_cloze':
      return (
        <TextBox title={part.title}>
          <GappedProse text={part.text} field={(n) => <TextGap n={n} {...common} />} />
        </TextBox>
      );

    case 'word_formation':
      return (
        <TextBox title={part.title}>
          <GappedProse
            text={part.text}
            field={(n) => (
              <>
                <TextGap n={n} wide {...common} />
                <span className="tabular-nums text-body-sm font-medium text-accent-text">
                  {part.gaps.find((gap) => gap.n === n)?.stem}
                </span>
              </>
            )}
          />
        </TextBox>
      );

    case 'completion':
      return (
        <TextBox title={part.title}>
          {part.text.split('\n').map((line, index) =>
            line.trim() === '' ? null : (
              <p key={index} lang={lang} className="prose-reading leading-[2.75rem]">
                {splitCloze(line).map((piece, pieceIndex) =>
                  typeof piece === 'string' ? (
                    <span key={pieceIndex}>{piece}</span>
                  ) : (
                    <span key={pieceIndex} className="whitespace-nowrap">
                      <GapNumber n={piece} />
                      <TextGap n={piece} wide {...common} />
                    </span>
                  ),
                )}
              </p>
            ),
          )}
        </TextBox>
      );

    case 'key_word_transformation': {
      const [min, max] = format.words ?? [2, 5];
      return (
        <div className="flex flex-col gap-4">
          <p className="tabular-nums text-body-sm text-muted">{t('uoe.wordLimit', { min, max })}</p>
          <ol className="flex flex-col gap-6">
            {part.items.map((item) => {
              const value = String(answers[item.n] ?? '');
              const words = value.trim() === '' ? 0 : countExamWords(value);
              return (
                <li key={item.n} className="flex flex-col gap-2">
                  <p lang={lang} className="prose-reading">
                    <span lang="es" className="tabular-nums mr-2 text-body-sm text-muted">
                      {item.n}.
                    </span>
                    {item.original}
                  </p>
                  <p lang={lang} className="text-body-sm font-medium text-accent-text tabular-nums">
                    {item.keyword}
                  </p>
                  <p lang={lang} className="prose-reading leading-[2.75rem]">
                    {item.before}
                    <input
                      type="text"
                      lang={lang}
                      aria-label={t('exams.question', { n: item.n })}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      className={cn(inlineField, 'w-64 max-w-full')}
                      value={value}
                      onChange={(event) => onAnswer(item.n, event.target.value)}
                    />
                    {item.after}
                  </p>
                  <p
                    className={cn(
                      'tabular-nums text-caption',
                      words > max ? 'text-error' : 'text-muted',
                    )}
                  >
                    {words === 1 ? t('uoe.wordCountOne') : t('uoe.wordCount', { n: words })}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      );
    }

    case 'gapped_text': {
      const ids = part.options.map((option) => option.id);
      const used = new Set(part.gaps.map((gap) => answers[gap.n]));
      return (
        <div className="grid gap-5 xl:grid-cols-2">
          <TextBox title={part.title}>
            <GappedProse
              text={part.text}
              field={(n) => <LetterSelect n={n} ids={ids} inline {...common} />}
            />
          </TextBox>
          <div className="flex flex-col gap-3 xl:sticky xl:top-52 xl:max-h-[calc(100dvh-14rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
            <h3 className="text-body-sm font-medium text-muted">{t('exams.optionsTitle')}</h3>
            <ul className="flex flex-col gap-2">
              {part.options.map((option) => (
                <li
                  key={option.id}
                  className={cn(
                    'flex gap-3 rounded-card bg-surface-2 px-3 py-2',
                    used.has(option.id) && 'opacity-55',
                  )}
                >
                  <span className="tabular-nums shrink-0 text-body-sm font-medium text-accent-text">
                    {option.id}
                  </span>
                  <span lang={lang} className="prose-reading whitespace-pre-line">
                    {option.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    case 'matching':
      return (
        <div className="flex flex-col gap-8">
          {part.tasks.map((task, index) => {
            const ids = task.options.map((option) => option.id);
            // Textos largos (Reading) frente a afirmaciones cortas (Listening).
            const long = task.options.some((option) => option.text.length > 160);
            const questions = (
              <ol className="flex flex-col gap-3">
                {task.questions.map((question) => (
                  <li key={question.n} className="flex items-start gap-3">
                    <span className="tabular-nums mt-2 w-7 shrink-0 text-body-sm text-muted">
                      {question.n}.
                    </span>
                    <span lang={lang} className="mt-1.5 min-w-0 flex-1">
                      {question.prompt}
                    </span>
                    <LetterSelect n={question.n} ids={ids} {...common} />
                  </li>
                ))}
              </ol>
            );
            const options = (
              <ul className={cn('flex flex-col', long ? 'gap-4' : 'gap-2')}>
                {task.options.map((option) =>
                  long ? (
                    <li key={option.id}>
                      <TextBox>
                        <h4 className="flex items-baseline gap-2">
                          <span className="tabular-nums font-medium text-accent-text">
                            {option.id}
                          </span>
                          {option.title ? (
                            <span lang={lang} className="font-medium">
                              {option.title}
                            </span>
                          ) : null}
                        </h4>
                        <Prose text={option.text} />
                      </TextBox>
                    </li>
                  ) : (
                    <li key={option.id} className="flex gap-3">
                      <span className="tabular-nums shrink-0 font-medium text-accent-text">
                        {option.id}
                      </span>
                      <span lang={lang}>{option.text}</span>
                    </li>
                  ),
                )}
              </ul>
            );
            return (
              <section key={index} className="flex flex-col gap-4">
                {task.heading ? (
                  <h3 lang={lang} className="font-medium">
                    {task.heading}
                  </h3>
                ) : null}
                {long ? (
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="xl:sticky xl:top-52 xl:self-start">{questions}</div>
                    <div>
                      {part.title ? (
                        <h3 lang={lang} className="mb-3 text-body-lg font-medium">
                          {part.title}
                        </h3>
                      ) : null}
                      {options}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="card">{options}</div>
                    {questions}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      );

    case 'writing': {
      const value = String(answers[part.n] ?? '');
      const words = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;
      return (
        <div className="flex flex-col gap-3">
          <TextBox>
            <Prose text={part.prompt} />
          </TextBox>
          <textarea
            lang={lang}
            aria-label={t('exams.question', { n: part.n })}
            spellCheck={false}
            rows={6}
            className={cn(fieldClasses, 'h-auto min-h-36 p-3')}
            value={value}
            onChange={(event) => onAnswer(part.n, event.target.value)}
          />
          <p
            className={cn(
              'tabular-nums text-caption',
              words < part.min_words ? 'text-muted' : 'text-success',
            )}
          >
            {t('exams.writingWords', { n: words, min: part.min_words })}
          </p>
          <p className="text-body-sm text-muted">{t('exams.writingNote')}</p>
        </div>
      );
    }
  }
}
