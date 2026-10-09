import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import {
  FEEDBACK_STATUS,
  type WritingFeedbackError,
  type WritingFeedbackResponse,
} from '@/features/writing/lib/api';
import { SubmissionInput } from '@/features/writing/lib/input';
import { cardCandidates, toOffer } from '@/features/writing/server/cards';
import { anthropicModel, requestFeedback } from '@/features/writing/server/feedback';
import { supabaseStore } from '@/features/writing/server/store';
import { WRITING_PROMPT_VERSION } from '@/lib/ai/prompts/writing';
import { requireUser } from '@/lib/auth';
import { getGrammarIndex } from '@/lib/content/grammar';
import { findWritingPrompt } from '@/lib/content/writing';
import { env } from '@/lib/env';
import { isSameOrigin } from '@/lib/http';

// Corrección de un writing con la IA: la única llamada en vivo a la API de Claude
// (docs/04-arquitectura/06-ia.md §3, ADR-0007). La clave no sale nunca del servidor.

/** La corrección puede tardar medio minuto: el modelo razona antes de contestar. */
export const maxDuration = 60;

const refuse = (error: WritingFeedbackError) =>
  NextResponse.json({ error }, { status: FEEDBACK_STATUS[error] });

let client: Anthropic | null = null;

/** Un solo cliente por proceso. Un reintento y un tiempo máximo por debajo de `maxDuration`. */
function getClient(apiKey: string): Anthropic {
  client ??= new Anthropic({
    apiKey,
    baseURL: env.ANTHROPIC_BASE_URL,
    maxRetries: 1,
    timeout: 50_000,
  });
  return client;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return refuse('forbidden');

  const session = await requireUser();
  if (!session.ok) return refuse('unauthorized');
  if (!env.ANTHROPIC_API_KEY) return refuse('ai_disabled');

  const parsed = SubmissionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuse('invalid_body');
  const { promptId, text, examMode, activeSeconds } = parsed.data;

  // La consigna sale del contenido del repo, no del navegador.
  const prompt = findWritingPrompt(promptId);
  if (!prompt) return refuse('not_found');

  const result = await requestFeedback(
    {
      store: supabaseStore(session.supabase),
      model: anthropicModel(getClient(env.ANTHROPIC_API_KEY), env.AI_WRITING_MODEL),
      limits: { daily: env.AI_DAILY_LIMIT, monthlyUsd: env.AI_MONTHLY_BUDGET_USD },
      grammarIds: getGrammarIndex().map((ficha) => ficha.id),
      now: new Date(),
    },
    { prompt, text, examMode, activeSeconds },
  );
  if (!result.ok) return refuse(result.error);

  const cards = cardCandidates({
    id: result.id,
    text,
    promptId: prompt.id,
    taskType: prompt.task_type,
    feedback: { kind: 'ai', feedback: result.feedback, promptVersion: WRITING_PROMPT_VERSION },
  });
  const body: WritingFeedbackResponse = {
    id: result.id,
    feedback: result.feedback,
    saved: result.saved,
    modelAnswer: prompt.model_answer,
    cards: toOffer(cards),
  };
  return NextResponse.json(body);
}
