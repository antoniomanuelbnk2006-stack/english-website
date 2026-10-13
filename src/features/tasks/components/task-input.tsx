'use client';

import { ArrowDown, ArrowUp, CircleCheck, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import type { GradeResult, TaskResponse } from '@/features/tasks/lib/grade';
import type { Task } from '@/lib/content/schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export interface TaskInputProps {
  task: Task;
  value: TaskResponse | undefined;
  onChange: (value: TaskResponse) => void;
  /** Tras comprobar: bloquea la entrada y pinta la corrección. */
  result: GradeResult | null;
  /** Prefijo único para `name` e `id` de los controles. */
  name: string;
  /** Id del enunciado, para enlazarlo como etiqueta del grupo. */
  labelledBy: string;
}

type Mark = 'correct' | 'wrong' | null;

/** Acierto o fallo con icono y texto: el color nunca es la única señal. */
function MarkIcon({ mark }: { mark: Mark }) {
  const t = useT();
  if (mark === 'correct') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-caption text-success">
        <CircleCheck aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="sr-only">{t('tasks.correctAnswer')}</span>
      </span>
    );
  }
  if (mark === 'wrong') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-caption text-error">
        <CircleX aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="sr-only">{t('tasks.yourAnswer')}</span>
      </span>
    );
  }
  return null;
}

const optionClasses = (selected: boolean, mark: Mark, locked: boolean) =>
  cn(
    'option',
    // Bloqueada o estática (una fila de «ordenar»): se ve igual, pero no responde al ratón.
    locked ? 'is-static' : 'cursor-pointer',
    selected && 'border-accent',
    // Acierto y fallo: borde y fondo al 12 %, además del icono y el texto que los acompañan.
    mark === 'correct' && 'border-success bg-success/12',
    mark === 'wrong' && 'border-error bg-error/12',
  );

function ChoiceGroup({
  options,
  selected,
  correct,
  locked,
  name,
  labelledBy,
  onSelect,
}: {
  options: { id: string; text: string; letter?: boolean }[];
  selected: string | undefined;
  /** Id de la opción correcta, solo cuando ya se ha comprobado. */
  correct: string | null;
  locked: boolean;
  name: string;
  labelledBy: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2">
      {options.map((option) => {
        const isSelected = selected === option.id;
        const mark: Mark =
          correct === null ? null : option.id === correct ? 'correct' : isSelected ? 'wrong' : null;
        return (
          <label key={option.id} className={optionClasses(isSelected, mark, locked)}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={isSelected}
              disabled={locked}
              onChange={() => onSelect(option.id)}
              className="size-4 shrink-0 accent-accent"
            />
            {option.letter === false ? null : (
              <span aria-hidden="true" className="tabular-nums text-caption text-muted uppercase">
                {option.id}
              </span>
            )}
            <span lang="en" className="min-w-0 flex-1">
              {option.text}
            </span>
            <MarkIcon mark={mark} />
          </label>
        );
      })}
    </div>
  );
}

/** Fila «elemento → desplegable» para emparejar (títulos de párrafo, hablantes y opiniones…). */
function PairRows({
  rows,
  choices,
  values,
  answers,
  parts,
  locked,
  name,
  onPick,
}: {
  rows: { id: string; label: ReactNode }[];
  choices: { id: string; text: string }[];
  values: Record<string, string>;
  answers: Record<string, string>;
  parts: Record<string, boolean> | null;
  locked: boolean;
  name: string;
  onPick: (rowId: string, choiceId: string) => void;
}) {
  const t = useT();
  const textOf = (id: string | undefined) => choices.find((c) => c.id === id)?.text ?? '';
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const mark: Mark = parts ? (parts[row.id] ? 'correct' : 'wrong') : null;
        const fieldId = `${name}-${row.id}`;
        return (
          <li key={row.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={fieldId} className="text-body-sm font-medium">
                {row.label}
              </label>
              <MarkIcon mark={mark} />
            </div>
            <Select
              id={fieldId}
              lang="en"
              value={values[row.id] ?? ''}
              disabled={locked}
              aria-invalid={mark === 'wrong' ? true : undefined}
              onChange={(event) => onPick(row.id, event.target.value)}
            >
              <option value="" lang="es">
                {t('tasks.choose')}
              </option>
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.text}
                </option>
              ))}
            </Select>
            {mark === 'wrong' ? (
              <p className="text-body-sm text-muted">
                {t('tasks.correctAnswer')}: <span lang="en">{textOf(answers[row.id])}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function TaskInput({ task, value, onChange, result, name, labelledBy }: TaskInputProps) {
  const t = useT();
  const locked = result !== null;

  switch (task.type) {
    case 'mcq':
      return (
        <ChoiceGroup
          options={task.options}
          selected={value?.type === 'mcq' ? value.answer : undefined}
          correct={locked ? task.answer : null}
          locked={locked}
          name={name}
          labelledBy={labelledBy}
          onSelect={(answer) => onChange({ type: 'mcq', answer })}
        />
      );

    case 'true_false_ng': {
      const options = [
        { id: 'T', text: 'True', letter: false },
        { id: 'F', text: 'False', letter: false },
        ...(task.allow_ng ? [{ id: 'NG', text: 'Not given', letter: false }] : []),
      ];
      return (
        <ChoiceGroup
          options={options}
          selected={value?.type === 'true_false_ng' ? value.answer : undefined}
          correct={locked ? task.answer : null}
          locked={locked}
          name={name}
          labelledBy={labelledBy}
          onSelect={(answer) =>
            onChange({ type: 'true_false_ng', answer: answer as 'T' | 'F' | 'NG' })
          }
        />
      );
    }

    case 'multi_select': {
      const chosen = value?.type === 'multi_select' ? value.answers : [];
      return (
        <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-2">
          {task.options.map((option) => {
            const isSelected = chosen.includes(option.id);
            const mark: Mark = !locked
              ? null
              : task.answers.includes(option.id)
                ? 'correct'
                : isSelected
                  ? 'wrong'
                  : null;
            return (
              <label key={option.id} className={optionClasses(isSelected, mark, locked)}>
                <input
                  type="checkbox"
                  name={name}
                  value={option.id}
                  checked={isSelected}
                  disabled={locked}
                  onChange={() =>
                    onChange({
                      type: 'multi_select',
                      answers: isSelected
                        ? chosen.filter((id) => id !== option.id)
                        : [...chosen, option.id],
                    })
                  }
                  className="size-4 shrink-0 accent-accent"
                />
                <span lang="en" className="min-w-0 flex-1">
                  {option.text}
                </span>
                <MarkIcon mark={mark} />
              </label>
            );
          })}
        </div>
      );
    }

    case 'short_answer': {
      const mark: Mark = result ? (result.correct ? 'correct' : 'wrong') : null;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Input
              lang="en"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-labelledby={labelledBy}
              aria-invalid={mark === 'wrong' ? true : undefined}
              disabled={locked}
              value={value?.type === 'short_answer' ? value.text : ''}
              onChange={(event) => onChange({ type: 'short_answer', text: event.target.value })}
            />
            <MarkIcon mark={mark} />
          </div>
          {mark === 'wrong' ? (
            <p className="text-body-sm text-muted">
              {t('tasks.acceptedAnswers', { answers: '' })}
              <span lang="en">{task.accept.join(' · ')}</span>
            </p>
          ) : null}
        </div>
      );
    }

    case 'gap_fill': {
      const filled = value?.type === 'gap_fill' ? value.gaps : {};
      const pieces = task.text.split(/(\{\{\d+\}\})/);
      const missed = result ? task.gaps.filter((gap) => !result.parts[String(gap.n)]) : [];
      return (
        <div className="flex flex-col gap-3">
          <p lang="en" className="leading-[2.75rem]">
            {pieces.map((piece, index) => {
              const match = /^\{\{(\d+)\}\}$/.exec(piece);
              if (!match) return <span key={index}>{piece}</span>;
              const n = match[1] ?? '';
              const mark: Mark = result ? (result.parts[n] ? 'correct' : 'wrong') : null;
              return (
                <span key={index} className="mx-1 inline-flex items-center gap-1 align-middle">
                  <Input
                    lang="en"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={t('tasks.gap', { n })}
                    aria-invalid={mark === 'wrong' ? true : undefined}
                    disabled={locked}
                    className={cn('h-10 w-36', mark === 'correct' && 'border-success')}
                    value={filled[n] ?? ''}
                    onChange={(event) =>
                      onChange({ type: 'gap_fill', gaps: { ...filled, [n]: event.target.value } })
                    }
                  />
                  <MarkIcon mark={mark} />
                </span>
              );
            })}
          </p>
          {missed.length > 0 ? (
            <ul className="flex flex-col gap-1 text-body-sm text-muted">
              {missed.map((gap) => (
                <li key={gap.n}>
                  {t('tasks.gap', { n: gap.n })} — {t('tasks.acceptedAnswers', { answers: '' })}
                  <span lang="en">{gap.accept.join(' · ')}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    case 'heading_match': {
      const picked = value?.type === 'heading_match' ? value.answers : {};
      return (
        <PairRows
          rows={task.paragraphs.map((id) => ({
            id,
            label: t('tasks.paragraph', { n: id.replace(/^p/, '') }),
          }))}
          choices={task.headings}
          values={picked}
          answers={task.answers}
          parts={result?.parts ?? null}
          locked={locked}
          name={name}
          onPick={(paragraph, heading) =>
            onChange({ type: 'heading_match', answers: { ...picked, [paragraph]: heading } })
          }
        />
      );
    }

    case 'matching': {
      const picked = value?.type === 'matching' ? value.pairs : {};
      return (
        <PairRows
          rows={task.left.map((item) => ({
            id: item.id,
            label: <span lang="en">{item.text}</span>,
          }))}
          choices={task.right}
          values={picked}
          answers={task.pairs}
          parts={result?.parts ?? null}
          locked={locked}
          name={name}
          onPick={(left, right) =>
            onChange({ type: 'matching', pairs: { ...picked, [left]: right } })
          }
        />
      );
    }

    case 'ordering': {
      const order = value?.type === 'ordering' ? value.order : task.items.map((item) => item.id);
      const textOf = (id: string) => task.items.find((item) => item.id === id)?.text ?? id;
      const move = (index: number, delta: number) => {
        const next = [...order];
        const target = index + delta;
        const a = next[index];
        const b = next[target];
        if (a === undefined || b === undefined) return;
        next[index] = b;
        next[target] = a;
        onChange({ type: 'ordering', order: next });
      };
      return (
        <div className="flex flex-col gap-3">
          <ol aria-labelledby={labelledBy} className="flex flex-col gap-2">
            {order.map((id, index) => {
              const mark: Mark = result ? (result.parts[id] ? 'correct' : 'wrong') : null;
              return (
                <li key={id} className={optionClasses(false, mark, true)}>
                  <span aria-hidden="true" className="tabular-nums text-caption text-muted">
                    {index + 1}
                  </span>
                  <span lang="en" className="min-w-0 flex-1">
                    {textOf(id)}
                  </span>
                  <MarkIcon mark={mark} />
                  {locked ? null : (
                    <span className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        aria-label={t('tasks.moveUp', { item: textOf(id) })}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === order.length - 1}
                        aria-label={t('tasks.moveDown', { item: textOf(id) })}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {result && !result.correct ? (
            <div className="text-body-sm text-muted">
              <p>{t('tasks.correctAnswer')}:</p>
              <ol lang="en" className="mt-1 list-decimal pl-5">
                {task.correct_order.map((id) => (
                  <li key={id}>{textOf(id)}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      );
    }

    case 'dictation':
      // El dictado tiene su propia vista en el ciclo de escucha (alineación palabra a palabra).
      return null;
  }
}
