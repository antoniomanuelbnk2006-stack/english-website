import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { FailureReason } from '@/features/writing/lib/limits';
import {
  normalizeFeedback,
  type WritingFeedback,
  WritingFeedbackOutput,
} from '@/features/writing/lib/schema';
import { costUsd, maxCostUsd, type TokenUsage } from '@/lib/ai/pricing';
import {
  buildWritingUserMessage,
  describeTask,
  WRITING_PROMPT_VERSION,
  WRITING_SYSTEM_PROMPT,
  type WritingTask,
} from '@/lib/ai/prompts/writing';
import { countWords, type WritingPrompt } from '@/lib/content/writing-schema';
import { startOfMonthMadrid, startOfTodayMadrid } from '@/lib/dates';

// Corrección de un writing con la IA (docs/04-arquitectura/06-ia.md §3). La lógica no sabe
// nada de Supabase ni del SDK: recibe un almacén y un modelo, y así se prueba con dobles.

/** Tokens de salida: incluyen el razonamiento del modelo. */
const MAX_TOKENS = 8000;

export type ModelReply =
  | { ok: true; output: WritingFeedbackOutput; usage: TokenUsage }
  | { ok: false; reason: FailureReason; usage: TokenUsage | null };

export interface FeedbackModel {
  id: string;
  assess(task: WritingTask): Promise<ModelReply>;
}

export interface NewSubmission {
  promptId: string;
  taskType: string;
  targetLevel: WritingPrompt['level'];
  text: string;
  wordCount: number;
  model: string;
  examMode: boolean;
  activeSeconds: number;
}

/** Lo que hace falta para pedir sitio a una llamada: cuánto puede costar y qué límites hay. */
export interface ReserveRequest {
  model: string;
  /** Lo máximo que puede costar la llamada: se aparta hasta saber el coste real. */
  reserveUsd: number;
  limits: { daily: number; monthlyUsd: number };
  /** Principio del día y del mes en curso (hora de Madrid). */
  dayStart: Date;
  monthStart: Date;
}

/** El resguardo de una reserva: sin él no se puede cerrar. No sale del servidor. */
export interface Reservation {
  id: string;
  token: string;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: 'daily_limit' | 'monthly_budget' | 'db' };

export interface FeedbackStore {
  /**
   * Comprueba el límite diario y el tope mensual y, si caben, aparta el gasto de una llamada.
   * Todo en una sola operación del registro `ai_usage` (ADR-0024): dos peticiones a la vez no
   * pueden pasar las dos por el último hueco.
   */
  reserve(request: ReserveRequest): Promise<ReserveResult>;
  /** Cierra la reserva con lo que la llamada ha costado de verdad. `false` si no se ha podido. */
  settle(
    reservation: Reservation,
    data: { outcome: 'done' | FailureReason; usage: TokenUsage | null; costUsd: number },
  ): Promise<boolean>;
  /** Crea la entrega en estado `pending` y devuelve su id. */
  create(submission: NewSubmission): Promise<string | null>;
  finish(
    id: string,
    data: {
      feedback: WritingFeedback & { prompt_version: string };
      usage: TokenUsage;
      costUsd: number;
    },
  ): Promise<boolean>;
  fail(
    id: string,
    data: { reason: FailureReason; usage: TokenUsage | null; costUsd: number },
  ): Promise<void>;
}

export type FeedbackError =
  'daily_limit' | 'monthly_budget' | 'db' | 'ai_failed' | 'ai_refused' | 'ai_truncated';

export type FeedbackResult =
  | { ok: true; id: string; feedback: WritingFeedback; saved: boolean }
  | { ok: false; error: FeedbackError };

export interface FeedbackDeps {
  store: FeedbackStore;
  model: FeedbackModel;
  limits: { daily: number; monthlyUsd: number };
  /** Ids de las fichas de gramática a las que puede remitir una corrección. */
  grammarIds: readonly string[];
  now: Date;
}

export interface FeedbackInput {
  prompt: WritingPrompt;
  text: string;
  examMode: boolean;
  activeSeconds: number;
}

const ERROR_OF: Record<FailureReason, FeedbackError> = {
  refusal: 'ai_refused',
  max_tokens: 'ai_truncated',
  api: 'ai_failed',
};

/**
 * Pide la corrección de un texto: reserva sitio dentro de los límites, registra la entrega,
 * llama al modelo, ajusta la respuesta y la guarda con su coste.
 */
export async function requestFeedback(
  deps: FeedbackDeps,
  input: FeedbackInput,
): Promise<FeedbackResult> {
  const { store, model, limits, now } = deps;
  const { prompt, text } = input;

  const task: WritingTask = {
    taskType: prompt.task_type,
    targetLevel: prompt.level,
    instructions: describeTask(prompt),
    text,
    grammarIds: deps.grammarIds,
  };

  // La reserva se hace antes de llamar: si la llamada se cuelga, ya cuenta para los límites.
  const inputChars = WRITING_SYSTEM_PROMPT.length + buildWritingUserMessage(task).length;
  const reserved = await store.reserve({
    model: model.id,
    reserveUsd: maxCostUsd(model.id, inputChars, MAX_TOKENS),
    limits,
    dayStart: startOfTodayMadrid(now),
    monthStart: startOfMonthMadrid(now),
  });
  if (!reserved.ok) return { ok: false, error: reserved.error };
  const { reservation } = reserved;

  const id = await store.create({
    promptId: prompt.id,
    taskType: prompt.task_type,
    targetLevel: prompt.level,
    text,
    wordCount: countWords(text),
    model: model.id,
    examMode: input.examMode,
    activeSeconds: input.activeSeconds,
  });
  if (!id) {
    // No se ha llegado a llamar: la reserva se cierra sin coste, como un fallo cualquiera.
    await store.settle(reservation, { outcome: 'api', usage: null, costUsd: 0 });
    return { ok: false, error: 'db' };
  }

  const reply = await model.assess(task);

  if (!reply.ok) {
    const cost = reply.usage ? costUsd(model.id, reply.usage) : 0;
    await store.settle(reservation, { outcome: reply.reason, usage: reply.usage, costUsd: cost });
    await store.fail(id, { reason: reply.reason, usage: reply.usage, costUsd: cost });
    return { ok: false, error: ERROR_OF[reply.reason] };
  }

  const cost = costUsd(model.id, reply.usage);
  // Si no se pudiera cerrar, la reserva sigue contando por su importe máximo: nunca de menos.
  await store.settle(reservation, { outcome: 'done', usage: reply.usage, costUsd: cost });
  const feedback = normalizeFeedback(reply.output, text, {
    targetLevel: prompt.level,
    grammarIds: new Set(deps.grammarIds),
  });
  const saved = await store.finish(id, {
    feedback: { ...feedback, prompt_version: WRITING_PROMPT_VERSION },
    usage: reply.usage,
    costUsd: cost,
  });
  // Si no se ha podido guardar, la corrección ya está pagada: se entrega igualmente.
  return { ok: true, id, feedback, saved };
}

// ───────────── Modelo: la API de Claude ─────────────

/**
 * Deja en el registro del servidor por qué ha fallado una corrección: sin esto, un modelo mal
 * escrito o una clave sin saldo solo se verían como «la IA no ha podido». Nunca incluye la
 * clave ni el texto del usuario: solo el tipo de error, el código HTTP y el mensaje de la API.
 */
function logFailure(what: string, error?: unknown): void {
  const status = (error as { status?: unknown } | undefined)?.status;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : '';
  console.error(
    `[writing-feedback] ${what}${typeof status === 'number' ? ` (HTTP ${status})` : ''}${detail ? ` · ${detail.slice(0, 500)}` : ''}`,
  );
}

/** Lo único del SDK que se usa: así un doble con este método basta para los tests. */
export interface MessagesClient {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
    ): PromiseLike<Pick<Anthropic.Message, 'content' | 'stop_reason' | 'usage'>>;
  };
}

/**
 * El modelo real. Se usa `create` y no `parse`: `parse` intenta leer el JSON antes de que se
 * pueda mirar `stop_reason`, y una respuesta cortada por `max_tokens` saldría como un error
 * cualquiera en vez de como lo que es.
 */
export function anthropicModel(client: MessagesClient, model: string): FeedbackModel {
  const format = zodOutputFormat(WritingFeedbackOutput);
  return {
    id: model,
    async assess(task) {
      let message: Awaited<ReturnType<MessagesClient['messages']['create']>>;
      try {
        message = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          // Prefijo estable y cacheable: el prompt del sistema no cambia entre peticiones.
          system: [
            { type: 'text', text: WRITING_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: buildWritingUserMessage(task) }],
          output_config: { effort: 'medium', format: { type: format.type, schema: format.schema } },
        });
      } catch (error) {
        logFailure('la llamada ha fallado', error);
        return { ok: false, reason: 'api', usage: null };
      }

      const usage: TokenUsage = message.usage;
      if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal', usage };
      if (message.stop_reason === 'max_tokens') return { ok: false, reason: 'max_tokens', usage };
      if (message.stop_reason !== 'end_turn') {
        logFailure(`stop_reason inesperado: ${message.stop_reason}`);
        return { ok: false, reason: 'api', usage };
      }

      const text = message.content.find((block) => block.type === 'text')?.text;
      if (text === undefined) return { ok: false, reason: 'api', usage };
      try {
        return { ok: true, output: format.parse(text), usage };
      } catch (error) {
        logFailure('la respuesta no cumple el esquema', error);
        return { ok: false, reason: 'api', usage };
      }
    },
  };
}
