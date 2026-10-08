import type { SynthesisResult, TtsProvider, WordEvent } from './types';
import { encodeWav } from './wav';

// Doble de pruebas del TTS: en vez de voz genera un tono por palabra, con tiempos exactos y
// deterministas. Permite probar el pipeline y el reproductor sin cuentas ni red.
// No sirve para contenido real: nadie aprende a escuchar con pitidos.

const SAMPLE_RATE = 24_000;

function parseSsml(ssml: string): { text: string; rate: number } {
  const percent = /<prosody[^>]*rate="([+-]?\d+(?:\.\d+)?)%"/.exec(ssml)?.[1];
  const text = ssml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return { text, rate: 1 + Number(percent ?? 0) / 100 };
}

export const fakeTts: TtsProvider = {
  id: 'fake',
  voicesFor: (accent, gender) => [`fake-${accent}-${gender}-1`, `fake-${accent}-${gender}-2`],

  synthesize({ ssml, voice }): Promise<SynthesisResult> {
    const { text, rate } = parseSsml(ssml);
    // Cada voz tiene su tono, para distinguir a los hablantes al oído.
    const pitch = 170 + ([...voice].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 9) * 14;
    const chunks: Int16Array[] = [];
    const words: WordEvent[] = [];
    let cursorMs = 0;

    const silence = (ms: number) => {
      chunks.push(new Int16Array(Math.round((ms / 1000) * SAMPLE_RATE)));
      cursorMs += ms;
    };
    silence(60 / rate); // silencio inicial, como el de un TTS real

    for (const piece of text.split(' ').filter(Boolean)) {
      const letters = piece.replace(/[^\p{L}\p{N}']/gu, '');
      if (letters === '') continue;
      const durationMs = (150 + 42 * letters.length) / rate;
      const count = Math.round((durationMs / 1000) * SAMPLE_RATE);
      const tone = new Int16Array(count);
      for (let i = 0; i < count; i++) {
        // Envolvente suave: sube y baja como una sílaba.
        const envelope = Math.sin((Math.PI * i) / count);
        tone[i] = Math.round(9000 * envelope * Math.sin((2 * Math.PI * pitch * i) / SAMPLE_RATE));
      }
      words.push({ text: piece.replace(/[.,!?;:"]+$/g, ''), offsetMs: cursorMs, durationMs });
      chunks.push(tone);
      cursorMs += durationMs;
      silence((/[.!?]$/.test(piece) ? 260 : /[,;:]$/.test(piece) ? 140 : 45) / rate);
    }

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Int16Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    return Promise.resolve({
      wav: encodeWav({ sampleRate: SAMPLE_RATE, samples }),
      words,
      sampleRate: SAMPLE_RATE,
    });
  },
};
