// Proveedor de TTS intercambiable (docs/05-contenido/01-pipeline.md §5, ADR-0005).

export interface WordEvent {
  text: string;
  /** Desde el inicio del audio del segmento. */
  offsetMs: number;
  durationMs: number;
}

export interface SynthesisResult {
  /** Fichero WAV completo (cabecera RIFF + PCM de 16 bits mono). */
  wav: Buffer;
  words: WordEvent[];
  sampleRate: number;
}

export interface TtsProvider {
  /** `fake` es un doble de pruebas (tonos en vez de voz): nunca para contenido real. */
  id: 'azure' | 'kokoro' | 'piper' | 'fake';
  voicesFor(accent: string, gender: 'female' | 'male'): string[];
  /**
   * ¿Es una voz de este proveedor? Si una lección fija una voz de otro (p. ej. una de
   * Azure) y se locuta con este, se ignora y se asigna una propia.
   */
  knowsVoice?(voice: string): boolean;
  synthesize(input: { ssml: string; voice: string }): Promise<SynthesisResult>;
}
