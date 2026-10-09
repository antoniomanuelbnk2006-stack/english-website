import type { NewCard } from '@/features/srs/lib/cards';
import { splitSentences, type Hint } from './checks';
import type { WritingFeedback } from './schema';

// Errores de un writing que pasan al repaso (07-writing §2.2, paso 6). Son tarjetas de
// gramática: la frase del usuario ya corregida, con un hueco donde estaba el fallo.

/** Como mucho, estas tarjetas por writing (igual que en la cosecha de una lectura). */
export const MAX_WRITING_CARDS = 5;
/** Un hueco más largo que esto no se puede teclear de memoria. */
const MAX_ANSWER_WORDS = 4;

export interface WritingCardSource {
  submissionId: string;
  /** Título de la consigna, para saber de dónde viene la tarjeta. */
  title: string;
}

export interface CardCandidate {
  /** Lo que se enseña al ofrecer la tarjeta. */
  front: string;
  back: string;
  card: NewCard;
}

/**
 * Qué palabras cambian entre lo escrito y la propuesta. Si la propuesta solo quita algo, el
 * hueco se amplía a la palabra de al lado para que haya algo que escribir.
 */
export function gapOf(
  match: string,
  suggestion: string,
): { before: string; answer: string; after: string } | null {
  const lead = /^\s*/.exec(suggestion)?.[0] ?? '';
  const from = match.trim().split(/\s+/);
  const to = suggestion.trim().split(/\s+/).filter(Boolean);
  if (to.length === 0) return null;

  const same = (a: string | undefined, b: string | undefined) =>
    a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();

  let prefix = 0;
  while (prefix < Math.min(from.length, to.length) && same(from[prefix], to[prefix])) prefix++;
  let suffix = 0;
  while (
    suffix < Math.min(from.length, to.length) - prefix &&
    same(from[from.length - 1 - suffix], to[to.length - 1 - suffix])
  ) {
    suffix++;
  }

  if (to.length - prefix - suffix === 0) {
    if (suffix > 0) suffix--;
    else if (prefix > 0) prefix--;
    else return null;
  }

  const answer = to.slice(prefix, to.length - suffix);
  if (answer.length === 0 || answer.length > MAX_ANSWER_WORDS) return null;
  const head = to.slice(0, prefix).join(' ');
  const tail = to.slice(to.length - suffix).join(' ');
  return {
    before: `${lead}${head}${head ? ' ' : ''}`,
    answer: answer.join(' ').replace(/[.,;:!?]+$/, ''),
    after: `${/[.,;:!?]+$/.exec(answer.at(-1) ?? '')?.[0] ?? ''}${tail ? ' ' : ''}${tail}`,
  };
}

/**
 * Tarjetas a partir de los posibles errores de la revisión sin IA. La frase de la tarjeta
 * lleva ya aplicadas las demás propuestas, para no repasar una frase con otros fallos.
 */
export function hintCards(
  text: string,
  hints: readonly Hint[],
  source: WritingCardSource,
): CardCandidate[] {
  const sentences = splitSentences(text);
  const candidates: CardCandidate[] = [];
  const seen = new Set<string>();

  for (const hint of hints) {
    if (!hint.card || hint.suggestion === null) continue;
    const sentence = sentences.find((s) => hint.start >= s.start && hint.end <= s.end);
    if (!sentence) continue;
    const gap = gapOf(hint.match, hint.suggestion);
    if (!gap) continue;

    const key = `wri:${hint.rule}:${gap.answer.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let prompt = '';
    let cursor = sentence.start;
    for (const other of hints) {
      if (other.suggestion === null || other.start < sentence.start || other.end > sentence.end) {
        continue;
      }
      prompt += text.slice(cursor, other.start);
      prompt += other === hint ? `${gap.before}___${gap.after}` : other.suggestion;
      cursor = other.end;
    }
    prompt += text.slice(cursor, sentence.end);

    candidates.push({
      front: sentence.text,
      back: gap.answer,
      card: {
        kind: 'grammar',
        lemma: null,
        source_lesson_id: null,
        // Una tarjeta por error y solución: el mismo fallo en otro writing no la duplica.
        source_segment_id: key,
        front: { prompt, context: sentence.text },
        back: {
          answers: [gap.answer],
          rule_es: hint.explanation_es,
          title: source.title,
          writing_id: source.submissionId,
          ...(hint.grammar_ref ? { grammar_id: hint.grammar_ref } : {}),
        },
      },
    });
    if (candidates.length >= MAX_WRITING_CARDS) break;
  }
  return candidates;
}

/**
 * Tarjetas que propone la IA para los errores recurrentes. Su anverso es una frase que
 * arreglar y su reverso la forma correcta con la regla: se repasan mirando la respuesta y
 * valorándose uno mismo, no tecleando.
 */
export function feedbackCards(
  feedback: Pick<WritingFeedback, 'srs_candidates'>,
  source: WritingCardSource,
): CardCandidate[] {
  return feedback.srs_candidates.slice(0, MAX_WRITING_CARDS).map((candidate, index) => {
    // Sin hueco de teclear: la respuesta lleva también la regla y no se puede comparar.
    const front = candidate.front.replace(/_{2,}/g, '…').trim();
    const back = candidate.back.trim();
    return {
      front,
      back,
      card: {
        kind: 'grammar',
        lemma: null,
        source_lesson_id: null,
        source_segment_id: `wri:${source.submissionId}:${index}`,
        front: { prompt: front },
        back: {
          answers: [back],
          rule_es: source.title,
          title: source.title,
          writing_id: source.submissionId,
        },
      },
    };
  });
}
