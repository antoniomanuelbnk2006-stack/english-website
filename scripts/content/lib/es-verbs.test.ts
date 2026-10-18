import { describe, expect, it } from 'vitest';
import { buildSpanishLexicon } from './es-lexicon';

// Los tiempos verbales que salen de unas pocas formas (futuro, subjuntivo, formas con pronombre…).
const lexicon = buildSpanishLexicon();
const lemmaOf = (form: string) => lexicon.get(form)?.lemma;

describe('verbos: todos los tiempos', () => {
  it.each([
    ['hablaré', 'hablar'],
    ['hablaría', 'hablar'],
    ['hable', 'hablar'],
    ['hablara', 'hablar'],
    ['habláramos', 'hablar'],
    ['jugué', 'jugar'],
    ['juegue', 'jugar'],
    ['tendré', 'tener'],
    ['tenga', 'tener'],
    ['tengamos', 'tener'],
    ['tuviera', 'tener'],
    ['hiciéramos', 'hacer'],
    ['diría', 'decir'],
    ['pueda', 'poder'],
    ['podamos', 'poder'],
    ['pidamos', 'pedir'],
    ['sintamos', 'sentir'],
    ['sea', 'ser'],
    ['fuéramos', 'ser'],
    ['vaya', 'ir'],
    ['haya', 'haber'],
    ['comerlo', 'comer'],
    ['pensemos', 'pensar'],
    ['jueguen', 'jugar'],
    ['juguemos', 'jugar'],
    ['viviría', 'vivir'],
    ['comiésemos', 'comer'],
  ])('«%s» es una forma de «%s»', (form, lemma) => {
    // Los verbos del mazo y los de la tabla; si el lema no está en ninguno, el test lo dice.
    expect(lemmaOf(form), form).toBe(lemma);
  });
});
