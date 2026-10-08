// Lectura y escritura de WAV PCM de 16 bits mono, que es lo que devuelve el TTS. Lógica pura.

export interface Pcm {
  sampleRate: number;
  samples: Int16Array;
}

export function parseWav(wav: Buffer): Pcm {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('el audio no es un WAV (falta la cabecera RIFF/WAVE)');
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = wav.readUInt16LE(body + 2);
      sampleRate = wav.readUInt32LE(body + 4);
      bits = wav.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (channels !== 1 || bits !== 16) {
        throw new Error(`se esperaba PCM mono de 16 bits y llegó ${channels} canal(es) de ${bits} bits`);
      }
      // Algunos servicios dejan el tamaño a 0 o a 0xFFFFFFFF cuando emiten en streaming.
      const end = size === 0 || body + size > wav.length ? wav.length : body + size;
      const count = Math.floor((end - body) / 2);
      const samples = new Int16Array(count);
      for (let i = 0; i < count; i++) samples[i] = wav.readInt16LE(body + i * 2);
      return { sampleRate, samples };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('el WAV no tiene bloque de datos');
}

export function encodeWav({ sampleRate, samples }: Pcm): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = samples.length * 2;
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(samples[i] ?? 0, i * 2);
  return Buffer.concat([header, data]);
}

/**
 * Quita el silencio del principio y del final (el TTS añade el suyo y las pausas las decide
 * el pipeline). Devuelve también cuánto se recortó al principio, para desplazar los tiempos.
 */
export function trimSilence(
  pcm: Pcm,
  { threshold = 200, keepMs = 30 }: { threshold?: number; keepMs?: number } = {},
): { pcm: Pcm; trimmedStartMs: number } {
  const { samples, sampleRate } = pcm;
  const keep = Math.round((keepMs / 1000) * sampleRate);
  let first = 0;
  while (first < samples.length && Math.abs(samples[first] ?? 0) < threshold) first++;
  if (first === samples.length) return { pcm, trimmedStartMs: 0 }; // todo silencio: no se toca
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last] ?? 0) < threshold) last--;

  const start = Math.max(0, first - keep);
  const end = Math.min(samples.length, last + 1 + keep);
  return {
    pcm: { sampleRate, samples: samples.slice(start, end) },
    trimmedStartMs: (start / sampleRate) * 1000,
  };
}
