import type { ExamPaperKind, ExamSection } from '@/lib/content/exam-formats';
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

export const PAPER_HINT: Record<ExamPaperKind, TranslationKey> = {
  reading: 'exams.paperReadingHint',
  listening: 'exams.paperListeningHint',
  speaking: 'exams.paperSpeakingHint',
};
