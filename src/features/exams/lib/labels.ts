import type { ExamPaperKind, ExamSection, ExamSystem } from '@/lib/content/exam-formats';
import type { TranslationKey } from '@/lib/i18n';
import type { ScaleBand } from './scale';

// Claves de texto de las piezas del examen.

export const BAND_LABEL: Record<ScaleBand, TranslationKey> = {
  grade_a: 'exams.bandGradeA',
  grade_b: 'exams.bandGradeB',
  grade_c: 'exams.bandGradeC',
  level_below: 'exams.bandLevelBelow',
  below: 'exams.bandBelow',
};

export const SECTION_LABEL: Record<ExamSection, TranslationKey> = {
  reading: 'exams.sectionReading',
  use_of_english: 'exams.sectionUseOfEnglish',
  listening: 'exams.sectionListening',
  writing: 'exams.sectionWriting',
};

/** Las secciones del DELE llevan su nombre en el idioma de la interfaz; las de Cambridge, en inglés. */
export function sectionLabel(section: ExamSection, system: ExamSystem): TranslationKey {
  if (system === 'dele' && section === 'reading') return 'exams.sectionReadingDele';
  if (system === 'dele' && section === 'listening') return 'exams.sectionListeningDele';
  return SECTION_LABEL[section];
}

export const PAPER_HINT: Record<ExamPaperKind, TranslationKey> = {
  reading: 'exams.paperReadingHint',
  listening: 'exams.paperListeningHint',
  speaking: 'exams.paperSpeakingHint',
};
