// Resumen de una lección recién hecha, a partir de las tareas corregidas. Lógica pura.

export interface ScoredTask {
  id: string;
  focus: string;
  score: number;
}

export interface FocusBreakdown {
  focus: string;
  /** Suma de notas (los aciertos parciales cuentan su parte). */
  hits: number;
  total: number;
}

/** Media de las notas, de 0 a 1; `null` si no hay tareas. */
export function meanScore(tasks: readonly ScoredTask[]): number | null {
  if (tasks.length === 0) return null;
  return tasks.reduce((sum, task) => sum + task.score, 0) / tasks.length;
}

/** Aciertos por tipo de pregunta, en el orden en que aparecen: «¿flojeas en inferencia?». */
export function byFocus(tasks: readonly ScoredTask[]): FocusBreakdown[] {
  const groups = new Map<string, FocusBreakdown>();
  for (const task of tasks) {
    const group = groups.get(task.focus) ?? { focus: task.focus, hits: 0, total: 0 };
    group.hits += task.score;
    group.total += 1;
    groups.set(task.focus, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    hits: Number(group.hits.toFixed(2)),
  }));
}

/** Porcentaje entero para mostrar (0–100). */
export function toPercent(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

/** «2:51» a partir de milisegundos. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
