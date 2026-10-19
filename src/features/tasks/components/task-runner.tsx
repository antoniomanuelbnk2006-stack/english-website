'use client';

import { CircleCheck, CircleDashed, CircleX, MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useContentLanguage } from '@/components/content-language';
import { Button } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Chip } from '@/components/ui/panel';
import { grade, isAnswered, type GradeResult, type TaskResponse } from '@/features/tasks/lib/grade';
import type { Task } from '@/lib/content/schema';
import { useT } from '@/lib/i18n/client';
import { TaskInput } from './task-input';

export interface CheckedTask {
  task: Task;
  response: TaskResponse;
  result: GradeResult;
  durationMs: number;
}

/** En «ordenar», el orden inicial ya es una respuesta: se puede comprobar sin mover nada. */
function initialResponse(task: Task): TaskResponse | undefined {
  return task.type === 'ordering'
    ? { type: 'ordering', order: task.items.map((item) => item.id) }
    : undefined;
}

function Verdict({ result }: { result: GradeResult }) {
  const t = useT();
  const parts = Object.values(result.parts);
  if (result.correct) {
    return (
      <p className="flex items-center gap-2 font-medium text-success">
        <CircleCheck aria-hidden="true" className="size-5" strokeWidth={2} />
        {t('tasks.correct')}
      </p>
    );
  }
  if (result.score > 0 && parts.length > 1) {
    return (
      <p className="flex items-center gap-2 font-medium text-warning">
        <CircleDashed aria-hidden="true" className="size-5" strokeWidth={2} />
        {t('tasks.partial', { hits: parts.filter(Boolean).length, total: parts.length })}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 font-medium text-error">
      <CircleX aria-hidden="true" className="size-5" strokeWidth={2} />
      {t('tasks.incorrect')}
    </p>
  );
}

/**
 * Presenta las tareas de una en una: responder → comprobar → explicación → siguiente.
 * La corrección es inmediata (las claves van en la lección); el servidor vuelve a corregir al guardar.
 */
export function TaskRunner({
  tasks,
  onChecked,
  onDone,
  onShowEvidence,
  doneLabel,
  busy = false,
}: {
  tasks: readonly Task[];
  onChecked: (checked: CheckedTask) => void;
  onDone: () => void;
  /** Resalta en el texto las frases donde estaba la respuesta. */
  onShowEvidence?: (refs: string[]) => void;
  /** Texto del botón tras la última tarea. */
  doneLabel?: string;
  busy?: boolean;
}) {
  const t = useT();
  const language = useContentLanguage();
  const uid = useId();
  const [index, setIndex] = useState(0);
  const task = tasks[index];
  const [response, setResponse] = useState<TaskResponse | undefined>(() =>
    task ? initialResponse(task) : undefined,
  );
  const [result, setResult] = useState<GradeResult | null>(null);
  const startedAt = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  // Al comprobar, el foco pasa a la corrección para que el lector de pantalla la lea.
  useEffect(() => {
    if (result) feedbackRef.current?.focus();
  }, [result]);

  if (!task) return null;
  const promptId = `${uid}-prompt`;
  const isLast = index === tasks.length - 1;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;

    if (result === null) {
      if (!response || !isAnswered(task, response)) return;
      const graded = grade(task, response, language);
      setResult(graded);
      onChecked({ task, response, result: graded, durationMs: Date.now() - startedAt.current });
      return;
    }

    if (isLast) {
      onDone();
      return;
    }
    const next = tasks[index + 1];
    setIndex(index + 1);
    setResponse(next ? initialResponse(next) : undefined);
    setResult(null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex items-center justify-between gap-3">
        <p className="tabular-nums text-caption text-muted">
          {t('tasks.questionOf', { n: index + 1, total: tasks.length })}
        </p>
        <Chip>{t(`focus.${task.focus}`)}</Chip>
      </div>

      <h3 id={promptId} lang="en" className="text-body-lg leading-snug font-medium">
        {task.prompt}
      </h3>

      <TaskInput
        // Cada tarea monta sus controles de cero.
        key={task.id}
        task={task}
        value={response}
        onChange={setResponse}
        result={result}
        name={`${uid}-${task.id}`}
        labelledBy={promptId}
      />

      {result ? (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="status"
          data-tone={result.correct ? 'success' : result.score > 0 ? 'warning' : 'error'}
          className="feedback flex-col items-stretch gap-2 outline-none"
        >
          <Verdict result={result} />
          {task.rationale_es ? (
            <p className="text-body-sm text-muted">
              <InlineText text={task.rationale_es} />
            </p>
          ) : null}
          {onShowEvidence ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onShowEvidence(task.evidence)}
            >
              <MapPin aria-hidden="true" strokeWidth={1.75} />
              {t('tasks.showEvidence')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={busy || (result === null && !isAnswered(task, response))}
        className="self-stretch sm:self-end"
      >
        {result === null
          ? t('tasks.check')
          : isLast
            ? (doneLabel ?? t('tasks.finish'))
            : t('tasks.next')}
      </Button>
    </form>
  );
}
