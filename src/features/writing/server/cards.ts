import 'server-only';
import { feedbackCards, hintCards, type CardCandidate } from '@/features/writing/lib/cards';
import { findHints, isFormal } from '@/features/writing/lib/checks';
import type { StoredFeedback } from '@/features/writing/lib/schema';
import { findWritingPrompt } from '@/lib/content/writing';
import { WritingTaskType } from '@/lib/content/writing-schema';

/**
 * Tarjetas de repaso que se pueden sacar de una entrega. Se calculan siempre en el servidor a
 * partir de lo guardado: el navegador solo dice cuáles quiere, por su posición.
 */
export function cardCandidates(submission: {
  id: string;
  text: string;
  promptId: string | null;
  taskType: string;
  feedback: StoredFeedback | null;
}): CardCandidate[] {
  const prompt = submission.promptId ? findWritingPrompt(submission.promptId) : null;
  const source = { submissionId: submission.id, title: prompt?.title ?? submission.taskType };

  if (submission.feedback?.kind === 'ai') {
    return feedbackCards(submission.feedback.feedback, source);
  }
  const taskType = WritingTaskType.safeParse(submission.taskType);
  const formal = taskType.success && isFormal(taskType.data);
  return hintCards(submission.text, findHints(submission.text, { formal }), source);
}

/** Lo que se enseña de cada tarjeta propuesta. */
export const toOffer = (candidates: readonly CardCandidate[]) =>
  candidates.map(({ front, back }) => ({ front, back }));
