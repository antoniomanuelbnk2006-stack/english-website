// Límites de la corrección con IA (docs/04-arquitectura/06-ia.md §3.4): un máximo de
// correcciones al día y un tope de gasto al mes. Los dos se comprueban antes de cada llamada.

export type LimitState = 'ok' | 'daily_limit' | 'monthly_budget';

export interface Usage {
  /** Correcciones pedidas hoy (día de Madrid) que cuentan para el límite. */
  usedToday: number;
  dailyLimit: number;
  /** Gasto de este mes (mes de Madrid). */
  spentMonthUsd: number;
  monthlyBudgetUsd: number;
}

export function checkLimits(usage: Usage): LimitState {
  if (usage.usedToday >= usage.dailyLimit) return 'daily_limit';
  if (usage.spentMonthUsd >= usage.monthlyBudgetUsd) return 'monthly_budget';
  return 'ok';
}

/** Correcciones que quedan hoy (nunca negativo). */
export function remainingToday(usage: Pick<Usage, 'usedToday' | 'dailyLimit'>): number {
  return Math.max(0, usage.dailyLimit - usage.usedToday);
}

/** Por qué terminó mal un envío a la IA. Se guarda en `feedback` de la fila con error. */
export type FailureReason = 'refusal' | 'max_tokens' | 'api';

/** Un envío a la IA de este mes, tal como está en `writing_submissions`. */
export interface Attempt {
  createdAt: string;
  status: string;
  costUsd: number;
  /** Solo en los envíos con error. */
  reason: FailureReason | null;
}

/**
 * Lo consumido, a partir de los envíos a la IA del mes en curso.
 *
 * - Al límite diario no le cuentan los envíos que el modelo rechazó o dejó a medias (no es
 *   culpa del usuario), pero sí los que fallaron por la red o la API: así un fallo repetido
 *   no dispara llamadas sin control.
 * - Al tope mensual le cuenta todo lo que se haya cobrado, saliera bien o no.
 */
export function usageFrom(
  attempts: readonly Attempt[],
  startOfToday: Date,
): Pick<Usage, 'usedToday' | 'spentMonthUsd'> {
  const today = startOfToday.getTime();
  const free = (attempt: Attempt) =>
    attempt.status === 'error' && (attempt.reason === 'refusal' || attempt.reason === 'max_tokens');
  return {
    usedToday: attempts.filter(
      (attempt) => new Date(attempt.createdAt).getTime() >= today && !free(attempt),
    ).length,
    spentMonthUsd:
      Math.round(attempts.reduce((sum, attempt) => sum + attempt.costUsd, 0) * 100_000) / 100_000,
  };
}
