'use server';

import { z } from 'zod';
import { CAUSES } from '@/features/listening/lib/dictation';
import {
  TRANSCRIPT_FROM_PHASE,
  toTranscript,
  type ListeningTranscript,
} from '@/features/listening/lib/views';
import type { LexiconSnapshot } from '@/features/lexicon/components/use-lexicon-session';
import { getKnownLemmas, getLexiconSnapshot } from '@/features/lexicon/server/queries';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { loadListeningLesson } from '@/lib/content/loader';
import { LessonId, SegmentId } from '@/lib/content/schema';

const LessonRef = z.object({ lessonId: LessonId });

export interface TranscriptPayload extends ListeningTranscript {
  /** Lemas de la lección que el usuario conoce (para proponer la causa de cada fallo). */
  knownLemmas: string[];
  /** Niveles, estados y tarjetas de las palabras de la lección (glosario y cosecha). */
  lexicon: LexiconSnapshot;
}

/**
 * Entrega la transcripción solo si el progreso guardado ya ha superado las dos escuchas.
 * Así el guion no llega al navegador antes de tiempo, ni siquiera por la pestaña de red.
 */
export async function getTranscript(input: unknown): Promise<ActionResult<TranscriptPayload>> {
  const parsed = LessonRef.safeParse(input);
  if (!parsed.success) return fail('invalid_input');

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const lesson = await loadListeningLesson(parsed.data.lessonId);
  if (!lesson) return fail('not_found');

  const { data: progress, error } = await session.supabase
    .from('lesson_progress')
    .select('phase')
    .eq('lesson_id', lesson.id)
    .maybeSingle();
  if (error) return fail('internal');
  if (!progress || progress.phase < TRANSCRIPT_FROM_PHASE) return fail('conflict');

  const [known, lexicon] = await Promise.all([
    getKnownLemmas(lesson.segments.flatMap((segment) => segment.tokens)),
    getLexiconSnapshot(lesson),
  ]);
  return ok({ ...toTranscript(lesson), knownLemmas: [...known], lexicon });
}

const DiagnosticsInput = z.object({
  lessonId: LessonId,
  items: z
    .array(
      z.object({
        segmentId: SegmentId,
        cause: z.enum(CAUSES),
        /** `user` si el usuario corrigió la causa propuesta. */
        causeSource: z.enum(['auto', 'user']),
        expected: z.string().min(1).max(300),
        typed: z.string().max(300).nullable(),
        playbackRate: z.number().min(0.5).max(1.5),
      }),
    )
    .max(40),
});

/** Guarda cada fallo del dictado con su causa: es la base del perfil «Tu oído». */
export async function saveDiagnostics(input: unknown): Promise<ActionResult<{ saved: number }>> {
  const parsed = DiagnosticsInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { lessonId, items } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const lesson = await loadListeningLesson(lessonId);
  if (!lesson) return fail('not_found');
  const segments = new Set(lesson.segments.map((segment) => segment.id));
  if (items.some((item) => !segments.has(item.segmentId))) return fail('invalid_input');
  if (items.length === 0) return ok({ saved: 0 });

  const { error } = await session.supabase.from('listening_diagnostics').insert(
    items.map((item) => ({
      lesson_id: lesson.id,
      segment_id: item.segmentId,
      cause: item.cause,
      cause_source: item.causeSource,
      expected: item.expected,
      typed: item.typed,
      // Los rasgos salen de la lección, no de lo que diga el cliente.
      features: [
        ...new Set(
          lesson.connected_speech.filter((f) => f.ref === item.segmentId).map((f) => f.type),
        ),
      ],
      playback_rate: item.playbackRate,
    })),
  );
  if (error) return fail('internal');
  return ok({ saved: items.length });
}

const SelfRatingInput = z.object({
  lessonId: LessonId,
  /** «¿Cuánto entiendes?» de 0 a 100, tras la primera escucha o tras la final. */
  moment: z.enum(['initial', 'final']),
  value: z.number().int().min(0).max(100),
});

export async function saveSelfRating(input: unknown): Promise<ActionResult<null>> {
  const parsed = SelfRatingInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const { lessonId, moment, value } = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');

  const { error } = await session.supabase
    .from('lesson_progress')
    .update(moment === 'initial' ? { self_rating_initial: value } : { self_rating_final: value })
    .eq('lesson_id', lessonId);
  if (error) return fail('internal');
  return ok(null);
}
