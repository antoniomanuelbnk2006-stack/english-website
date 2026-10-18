import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { feedbackErrorOf } from '@/features/writing/lib/api';
import type { Attempt, FailureReason } from '@/features/writing/lib/limits';
import { checkLimits, usageFrom } from '@/features/writing/lib/limits';
import type { WritingFeedbackOutput } from '@/features/writing/lib/schema';
import { WRITING_SYSTEM_PROMPT, writingSystemPrompt } from '@/lib/ai/prompts/writing';
import type { WritingPrompt } from '@/lib/content/writing-schema';
import { isSameOrigin } from '@/lib/http';
import {
  anthropicModel,
  requestFeedback,
  type FeedbackDeps,
  type FeedbackModel,
  type FeedbackStore,
  type MessagesClient,
  type ModelReply,
} from './feedback';

// Tests con el almacén y el SDK de Anthropic simulados: ninguna llamada sale a la red.

const NOW = new Date('2026-10-09T10:00:00Z'); // viernes, 12:00 en Madrid
const TEXT = 'I am agree that online classes are useful. It depends of the teacher.';
const USAGE = { input_tokens: 2500, output_tokens: 2000 };

const PROMPT: WritingPrompt = {
  id: 'b2-wri-001',
  version: 1,
  status: 'published',
  level: 'B2',
  task_type: 'essay',
  title: 'Classroom or online?',
  topic: 'education',
  context_es: 'Un ensayo.',
  prompt_en: 'Is it better to learn in a classroom than to study online?',
  points: ['flexibility', 'contact with other people'],
  words_min: 140,
  words_max: 190,
  time_min: 40,
  useful_language: ['However, …', 'In my view, …', 'To sum up, …'],
  tips_es: ['Registro formal.'],
  model_answer: 'Model answer.',
  provenance: { origin: 'human', created_at: '2026-10-09T00:00:00Z' },
};

const OUTPUT: WritingFeedbackOutput = {
  overall_es: 'Se entiende, pero hay errores típicos.',
  estimated_level: 'B1',
  scores: { content: 3, communicative_achievement: 3, organisation: 2, language: 2 },
  corrections: [
    {
      original: 'I am agree',
      corrected: 'I agree',
      type: 'grammar',
      severity: 'major',
      explanation_es: '«Agree» ya es un verbo.',
      grammar_ref: 'a1.present-simple',
    },
    {
      original: 'no aparece en el texto',
      corrected: 'x',
      type: 'grammar',
      severity: 'minor',
      explanation_es: 'inventada',
      grammar_ref: '',
    },
  ],
  corrected_text: 'I agree that online classes are useful. It depends of the teacher.',
  upgrades: [{ from: 'useful', to: 'valuable', why_es: 'Más preciso.' }],
  focus_next_es: 'Las preposiciones.',
  srs_candidates: [{ front: 'I am agree.', back: 'I agree — verbo' }],
};

interface Row {
  id: string;
  status: 'pending' | 'done' | 'error';
  model: string;
  text: string;
  feedback: unknown;
  costUsd: number;
}

/** Una fila del registro de uso (`ai_usage`). */
interface Usage {
  id: string;
  status: 'pending' | 'done' | 'error';
  reason: FailureReason | null;
  reservedUsd: number;
  costUsd: number;
}

/**
 * Doble del almacén. `previous` son las llamadas que ya constan en el registro (`null`: la
 * base de datos falla). Los límites los aplica con las reglas de `lib/limits`, que son las
 * mismas que sigue `ai_usage_reserve` en la base de datos.
 */
function memoryStore(previous: Attempt[] | null = []) {
  const rows: Row[] = [];
  const ledger: Usage[] = [];
  const store: FeedbackStore = {
    reserve: vi.fn<FeedbackStore['reserve']>(async (request) => {
      if (!previous) return { ok: false, error: 'db' };
      const month = previous.filter((attempt) => new Date(attempt.createdAt) >= request.monthStart);
      const state = checkLimits({
        ...usageFrom(month, request.dayStart),
        dailyLimit: request.limits.daily,
        monthlyBudgetUsd: request.limits.monthlyUsd,
      });
      if (state !== 'ok') return { ok: false, error: state };
      const id = `use-${ledger.length + 1}`;
      ledger.push({
        id,
        status: 'pending',
        reason: null,
        reservedUsd: request.reserveUsd,
        costUsd: 0,
      });
      return { ok: true, reservation: { id, token: `token-${id}` } };
    }),
    settle: vi.fn(async (reservation, data) => {
      const usage = ledger.find((u) => u.id === reservation.id && u.status === 'pending');
      if (!usage || reservation.token !== `token-${usage.id}`) return false;
      Object.assign(
        usage,
        data.outcome === 'done' ? { status: 'done' } : { status: 'error', reason: data.outcome },
        { costUsd: data.costUsd },
      );
      return true;
    }),
    create: vi.fn(async (submission) => {
      const id = `row-${rows.length + 1}`;
      rows.push({
        id,
        status: 'pending',
        model: submission.model,
        text: submission.text,
        feedback: null,
        costUsd: 0,
      });
      return id;
    }),
    finish: vi.fn(async (id, data) => {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, { status: 'done', feedback: data.feedback, costUsd: data.costUsd });
      return true;
    }),
    fail: vi.fn(async (id, data) => {
      const row = rows.find((r) => r.id === id)!;
      Object.assign(row, {
        status: 'error',
        feedback: { error: data.reason },
        costUsd: data.costUsd,
      });
    }),
  };
  return { store, rows, ledger };
}

const model = (reply: ModelReply): FeedbackModel & { assess: ReturnType<typeof vi.fn> } => ({
  id: 'claude-sonnet-5-5',
  assess: vi.fn(async () => reply),
});

const deps = (store: FeedbackStore, m: FeedbackModel): FeedbackDeps => ({
  store,
  model: m,
  limits: { daily: 10, monthlyUsd: 5 },
  grammarIds: ['a1.present-simple'],
  now: NOW,
});
const INPUT = {
  prompt: PROMPT,
  text: TEXT,
  examMode: false,
  activeSeconds: 600,
  locale: 'es' as const,
};

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  createdAt: '2026-10-09T08:00:00Z',
  status: 'done',
  costUsd: 0.025,
  reason: null,
  ...over,
});

describe('requestFeedback', () => {
  it('corrige, ajusta la respuesta y la guarda con su coste y la versión del prompt', async () => {
    const { store, rows, ledger } = memoryStore();
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    const result = await requestFeedback(deps(store, m), INPUT);

    expect(result).toMatchObject({ ok: true, id: 'row-1', saved: true });
    if (!result.ok) throw new Error('debería haber salido bien');
    // La corrección inventada se descarta y la ficha de gramática conocida se conserva.
    expect(result.feedback.corrections).toHaveLength(1);
    expect(result.feedback.corrections[0]).toMatchObject({
      original: 'I am agree',
      grammar_ref: 'a1.present-simple',
    });

    expect(rows).toEqual([
      {
        id: 'row-1',
        status: 'done',
        model: 'claude-sonnet-5-5',
        text: TEXT,
        feedback: { ...result.feedback, prompt_version: 'writing@1' },
        costUsd: 0.025,
      },
    ]);
    // En el registro de uso, la reserva queda cerrada con lo que costó de verdad.
    expect(ledger).toEqual([
      {
        id: 'use-1',
        status: 'done',
        reason: null,
        reservedUsd: expect.any(Number),
        costUsd: 0.025,
      },
    ]);
  });

  it('antes de llamar aparta lo máximo que puede costar: la salida entera y la entrada', async () => {
    const { store, ledger } = memoryStore();
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    await requestFeedback(deps(store, m), INPUT);
    // 8.000 tokens de salida con Sonnet son 0,08 $; la entrada añade unos céntimos.
    expect(ledger[0]!.reservedUsd).toBeGreaterThan(0.08);
    expect(ledger[0]!.reservedUsd).toBeLessThan(0.1);
    expect(vi.mocked(store.reserve).mock.invocationCallOrder[0]).toBeLessThan(
      m.assess.mock.invocationCallOrder[0]!,
    );

    // Un texto más largo aparta más.
    const long = memoryStore();
    await requestFeedback(deps(long.store, model({ ok: true, output: OUTPUT, usage: USAGE })), {
      ...INPUT,
      text: TEXT.repeat(50),
    });
    expect(long.ledger[0]!.reservedUsd).toBeGreaterThan(ledger[0]!.reservedUsd);
  });

  it('manda al modelo la consigna del repositorio y las fichas de gramática', async () => {
    const { store } = memoryStore();
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    await requestFeedback(deps(store, m), INPUT);
    expect(m.assess).toHaveBeenCalledWith({
      taskType: 'essay',
      targetLevel: 'B2',
      instructions: expect.stringContaining('Is it better to learn in a classroom'),
      text: TEXT,
      grammarIds: ['a1.present-simple'],
      locale: 'es',
      language: 'en',
    });
    expect(m.assess.mock.calls[0]![0].instructions).toContain('Length: 140–190 words.');
  });

  it('con la interfaz en otro idioma, se lo pasa al modelo y lo apunta en la versión', async () => {
    const { store, rows } = memoryStore();
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    await requestFeedback(deps(store, m), { ...INPUT, locale: 'fr' });
    expect(m.assess.mock.calls[0]![0]).toMatchObject({ locale: 'fr' });
    expect(rows[0]!.feedback).toMatchObject({ prompt_version: 'writing@1+fr' });
  });

  it('el límite diario corta antes de llamar y sin registrar nada', async () => {
    const today = Array.from({ length: 10 }, () => attempt());
    const { store, rows, ledger } = memoryStore(today);
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    expect(await requestFeedback(deps(store, m), INPUT)).toEqual({
      ok: false,
      error: 'daily_limit',
    });
    expect(m.assess).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
    expect(ledger).toEqual([]);
  });

  it('con nueve correcciones hoy, la décima todavía pasa', async () => {
    const { store } = memoryStore(Array.from({ length: 9 }, () => attempt()));
    const result = await requestFeedback(
      deps(store, model({ ok: true, output: OUTPUT, usage: USAGE })),
      INPUT,
    );
    expect(result.ok).toBe(true);
  });

  it('las correcciones de ayer no cuentan para el límite de hoy', async () => {
    // Las 21:59 UTC del día 8 son las 23:59 en Madrid: todavía ayer.
    const yesterday = Array.from({ length: 10 }, () =>
      attempt({ createdAt: '2026-10-08T21:59:00Z' }),
    );
    const { store } = memoryStore(yesterday);
    const result = await requestFeedback(
      deps(store, model({ ok: true, output: OUTPUT, usage: USAGE })),
      INPUT,
    );
    expect(result.ok).toBe(true);
  });

  it('el tope mensual corta antes de llamar', async () => {
    // 200 correcciones de 0,025 $ a lo largo del mes: 5 $ justos.
    const month = Array.from({ length: 200 }, () => attempt({ createdAt: '2026-10-02T08:00:00Z' }));
    const { store, rows, ledger } = memoryStore(month);
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    expect(await requestFeedback(deps(store, m), INPUT)).toEqual({
      ok: false,
      error: 'monthly_budget',
    });
    expect(m.assess).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
    expect(ledger).toEqual([]);
  });

  it('los límites se piden para el día y el mes de Madrid', async () => {
    const { store } = memoryStore();
    await requestFeedback(deps(store, model({ ok: true, output: OUTPUT, usage: USAGE })), INPUT);
    // El 9 de octubre a las 00:00 de Madrid (UTC+2) son las 22:00 UTC del día 8, y el 1 de
    // octubre, las 22:00 UTC del 30 de septiembre.
    expect(store.reserve).toHaveBeenCalledWith({
      model: 'claude-sonnet-5-5',
      reserveUsd: expect.any(Number),
      limits: { daily: 10, monthlyUsd: 5 },
      dayStart: new Date('2026-10-08T22:00:00Z'),
      monthStart: new Date('2026-09-30T22:00:00Z'),
    });
  });

  it('si el modelo se niega, queda como error con su coste y no se entrega nada', async () => {
    const { store, rows, ledger } = memoryStore();
    const usage = { input_tokens: 2500, output_tokens: 20 };
    const result = await requestFeedback(
      deps(store, model({ ok: false, reason: 'refusal', usage })),
      INPUT,
    );
    expect(result).toEqual({ ok: false, error: 'ai_refused' });
    expect(rows[0]).toMatchObject({
      status: 'error',
      feedback: { error: 'refusal' },
      costUsd: 0.0052,
    });
    expect(ledger[0]).toMatchObject({ status: 'error', reason: 'refusal', costUsd: 0.0052 });
  });

  it('si la respuesta se corta por max_tokens, error controlado', async () => {
    const { store, rows, ledger } = memoryStore();
    const usage = { input_tokens: 2500, output_tokens: 8000 };
    const result = await requestFeedback(
      deps(store, model({ ok: false, reason: 'max_tokens', usage })),
      INPUT,
    );
    expect(result).toEqual({ ok: false, error: 'ai_truncated' });
    expect(rows[0]).toMatchObject({
      status: 'error',
      feedback: { error: 'max_tokens' },
      costUsd: 0.085,
    });
    expect(ledger[0]).toMatchObject({ status: 'error', reason: 'max_tokens', costUsd: 0.085 });
  });

  it('si la API falla, queda como error sin coste', async () => {
    const { store, rows, ledger } = memoryStore();
    const result = await requestFeedback(
      deps(store, model({ ok: false, reason: 'api', usage: null })),
      INPUT,
    );
    expect(result).toEqual({ ok: false, error: 'ai_failed' });
    expect(rows[0]).toMatchObject({ status: 'error', feedback: { error: 'api' }, costUsd: 0 });
    // Un fallo de la API gasta un intento (queda como error), pero no dinero.
    expect(ledger[0]).toMatchObject({ status: 'error', reason: 'api', costUsd: 0 });
  });

  it('si falla la base de datos al reservar o al registrar, no se llama al modelo', async () => {
    const m = model({ ok: true, output: OUTPUT, usage: USAGE });
    expect(await requestFeedback(deps(memoryStore(null).store, m), INPUT)).toEqual({
      ok: false,
      error: 'db',
    });

    const { store, ledger } = memoryStore();
    store.create = vi.fn(async () => null);
    expect(await requestFeedback(deps(store, m), INPUT)).toEqual({ ok: false, error: 'db' });
    expect(m.assess).not.toHaveBeenCalled();
    // La reserva no se queda abierta: se cierra sin coste.
    expect(ledger).toEqual([
      { id: 'use-1', status: 'error', reason: 'api', reservedUsd: expect.any(Number), costUsd: 0 },
    ]);
  });

  it('si no se puede guardar la corrección, se entrega igualmente (ya está pagada)', async () => {
    const { store, ledger } = memoryStore();
    store.finish = vi.fn(async () => false);
    const result = await requestFeedback(
      deps(store, model({ ok: true, output: OUTPUT, usage: USAGE })),
      INPUT,
    );
    expect(result).toMatchObject({ ok: true, saved: false });
    // El gasto sí consta, aunque la entrega no se haya guardado.
    expect(ledger[0]).toMatchObject({ status: 'done', costUsd: 0.025 });
  });

  it('si no se puede cerrar la reserva, sigue contando por su importe máximo', async () => {
    const { store, ledger } = memoryStore();
    store.settle = vi.fn(async () => false);
    const result = await requestFeedback(
      deps(store, model({ ok: true, output: OUTPUT, usage: USAGE })),
      INPUT,
    );
    expect(result).toMatchObject({ ok: true, saved: true });
    expect(ledger[0]).toMatchObject({ status: 'pending', costUsd: 0 });
    expect(ledger[0]!.reservedUsd).toBeGreaterThan(0.08);
  });
});

describe('usageFrom', () => {
  const startOfToday = new Date('2026-10-08T22:00:00Z'); // las 00:00 del día 9 en Madrid

  it('un rechazo o un corte del modelo no gastan un intento, pero sí dinero', () => {
    const usage = usageFrom(
      [
        attempt(),
        attempt({ status: 'error', reason: 'refusal', costUsd: 0.005 }),
        attempt({ status: 'error', reason: 'max_tokens', costUsd: 0.085 }),
      ],
      startOfToday,
    );
    expect(usage).toEqual({ usedToday: 1, spentMonthUsd: 0.115 });
  });

  it('un fallo de la API sí gasta un intento: un fallo repetido no dispara llamadas', () => {
    const usage = usageFrom(
      [
        attempt({ status: 'error', reason: 'api', costUsd: 0 }),
        attempt({ status: 'pending', costUsd: 0 }),
      ],
      startOfToday,
    );
    expect(usage).toEqual({ usedToday: 2, spentMonthUsd: 0 });
  });

  it('el gasto es el de todo el mes; los intentos, solo los de hoy', () => {
    const usage = usageFrom(
      [attempt({ createdAt: '2026-10-03T10:00:00Z', costUsd: 1.5 }), attempt({ costUsd: 0.5 })],
      startOfToday,
    );
    expect(usage).toEqual({ usedToday: 1, spentMonthUsd: 2 });
  });
});

// ───────────── El adaptador del SDK ─────────────

type Message = Pick<Anthropic.Message, 'content' | 'stop_reason' | 'usage'>;

const SDK_USAGE = {
  input_tokens: 2500,
  output_tokens: 2000,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
} as Anthropic.Usage;

const message = (over: Partial<Message> = {}): Message => ({
  content: [{ type: 'text', text: JSON.stringify(OUTPUT), citations: null }],
  stop_reason: 'end_turn',
  usage: SDK_USAGE,
  ...over,
});

function sdk(reply: Message | Error) {
  const create = vi.fn<MessagesClient['messages']['create']>(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
  const client: MessagesClient = { messages: { create } };
  return { client, create };
}

const TASK = {
  taskType: 'essay',
  targetLevel: 'B2',
  instructions: 'Write an essay.',
  text: TEXT,
  grammarIds: ['a1.present-simple'],
  locale: 'es' as const,
};

describe('anthropicModel (SDK simulado)', () => {
  it('llama con el modelo, el prompt cacheable, esfuerzo medio y salida estructurada', async () => {
    const { client, create } = sdk(message());
    const reply = await anthropicModel(client, 'claude-sonnet-5-5').assess(TASK);
    expect(reply).toEqual({ ok: true, output: OUTPUT, usage: SDK_USAGE });

    const params = create.mock.calls[0]![0];
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.max_tokens).toBe(8000);
    expect(params.system).toEqual([
      { type: 'text', text: WRITING_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ]);
    expect(params.output_config?.effort).toBe('medium');
    expect(params.output_config?.format).toMatchObject({ type: 'json_schema' });
    // El texto del usuario va como datos, delimitado, en el mensaje de usuario.
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0]).toMatchObject({ role: 'user' });
    expect(params.messages[0]!.content).toContain(`<learner_text>\n${TEXT}\n</learner_text>`);
  });

  it('refusal → error controlado, con lo que se ha cobrado', async () => {
    const { client } = sdk(message({ stop_reason: 'refusal', content: [] }));
    expect(await anthropicModel(client, 'm').assess(TASK)).toEqual({
      ok: false,
      reason: 'refusal',
      usage: SDK_USAGE,
    });
  });

  it('max_tokens → error controlado aunque el JSON esté cortado', async () => {
    const cut = JSON.stringify(OUTPUT).slice(0, 80);
    const { client } = sdk(
      message({
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: cut, citations: null }],
      }),
    );
    expect(await anthropicModel(client, 'm').assess(TASK)).toEqual({
      ok: false,
      reason: 'max_tokens',
      usage: SDK_USAGE,
    });
  });

  it('una respuesta que no es el JSON pedido cuenta como fallo de la API', async () => {
    for (const text of ['no es json', '{"overall_es": 3}']) {
      const { client } = sdk(message({ content: [{ type: 'text', text, citations: null }] }));
      expect(await anthropicModel(client, 'm').assess(TASK)).toMatchObject({
        ok: false,
        reason: 'api',
      });
    }
    const { client } = sdk(message({ content: [] }));
    expect(await anthropicModel(client, 'm').assess(TASK)).toMatchObject({ ok: false });
  });

  it('si el SDK lanza (red, 500, tiempo agotado), fallo de la API sin coste', async () => {
    const { client } = sdk(new Error('fetch failed'));
    expect(await anthropicModel(client, 'm').assess(TASK)).toEqual({
      ok: false,
      reason: 'api',
      usage: null,
    });
  });

  it('con la interfaz en otro idioma, usa el prompt del sistema de ese idioma', async () => {
    const { client, create } = sdk(message());
    await anthropicModel(client, 'm').assess({ ...TASK, locale: 'ja' });
    expect(create.mock.calls[0]![0].system).toEqual([
      { type: 'text', text: writingSystemPrompt('ja'), cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('acepta los valores de lista con otra caja en vez de perder la corrección', async () => {
    const odd = { ...OUTPUT, estimated_level: 'b1' };
    const { client } = sdk(
      message({ content: [{ type: 'text', text: JSON.stringify(odd), citations: null }] }),
    );
    expect(await anthropicModel(client, 'm').assess(TASK)).toMatchObject({ ok: true });
  });
});

describe('contrato del Route Handler', () => {
  it('lee el código de error de una respuesta fallida', () => {
    expect(feedbackErrorOf({ error: 'daily_limit' })).toBe('daily_limit');
    expect(feedbackErrorOf({ error: 'monthly_budget' })).toBe('monthly_budget');
    expect(feedbackErrorOf({ error: 'otra_cosa' })).toBe('ai_failed');
    expect(feedbackErrorOf(null)).toBe('ai_failed');
    expect(feedbackErrorOf('<html>')).toBe('ai_failed');
  });

  it('solo acepta peticiones de la propia app', () => {
    const headers = (init: Record<string, string>) => new Headers(init);
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(isSameOrigin(headers({ origin: 'https://senal.dev', host: 'senal.dev' }))).toBe(true);
    expect(isSameOrigin(headers({ origin: 'https://evil.example', host: 'senal.dev' }))).toBe(
      false,
    );
    expect(
      isSameOrigin(
        headers({
          origin: 'https://senal.dev',
          host: 'internal:3000',
          'x-forwarded-host': 'senal.dev',
        }),
      ),
    ).toBe(true);
    // Sin ninguna cabecera que lo acredite, se rechaza.
    expect(isSameOrigin(headers({ host: 'senal.dev' }))).toBe(false);
    expect(isSameOrigin(headers({ origin: 'null', host: 'senal.dev' }))).toBe(false);
  });
});
