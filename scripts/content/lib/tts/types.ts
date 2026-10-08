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
  id: 'azure' | 'kokoro' | 'fake';
  voicesFor(accent: string, gender: 'female' | 'male'): string[];
  synthesize(input: { ssml: string; voice: string }): Promise<SynthesisResult>;
}
