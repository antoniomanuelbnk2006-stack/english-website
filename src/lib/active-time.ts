// Tiempo activo (docs/03-producto/04-gamificacion.md §2 y docs/01-pedagogia/04-reading.md §5):
// cuenta mientras suena audio o ha habido interacción en los últimos 60 s. Lógica pura: el reloj se inyecta.

export const IDLE_AFTER_MS = 60_000;

export class ActiveClock {
  private activeMs = 0;
  /** Instante hasta el que ya se ha contabilizado. */
  private countedUntil: number;
  private lastInteraction: number;
  private playing = false;
  private paused = false;

  constructor(now: number) {
    this.countedUntil = now;
    this.lastInteraction = now;
  }

  /** Suma el tramo activo transcurrido desde la última llamada. */
  private advance(now: number): void {
    if (now <= this.countedUntil) return;
    if (!this.paused) {
      const activeUntil = this.playing ? now : Math.min(now, this.lastInteraction + IDLE_AFTER_MS);
      if (activeUntil > this.countedUntil) this.activeMs += activeUntil - this.countedUntil;
    }
    this.countedUntil = now;
  }

  /** Tecla, toque o scroll. */
  interact(now: number): void {
    this.advance(now);
    this.lastInteraction = now;
  }

  /** Audio sonando: cuenta aunque no se toque nada. */
  setPlaying(playing: boolean, now: number): void {
    this.advance(now);
    this.playing = playing;
    // Al parar el audio se concede el margen de inactividad desde ese momento.
    if (!playing) this.lastInteraction = now;
  }

  /** Pestaña oculta o lección en pausa: no cuenta nada. */
  setPaused(paused: boolean, now: number): void {
    this.advance(now);
    if (this.paused && !paused) this.lastInteraction = now;
    this.paused = paused;
  }

  totalMs(now: number): number {
    this.advance(now);
    return this.activeMs;
  }

  /** Devuelve lo acumulado y vuelve a cero (para enviar incrementos al servidor). */
  take(now: number): number {
    const total = this.totalMs(now);
    this.activeMs = 0;
    return total;
  }
}

/** Palabras por minuto de lectura activa. `null` si el tiempo no permite calcularlo. */
export function wordsPerMinute(wordCount: number, activeMs: number): number | null {
  if (wordCount <= 0 || activeMs < 1000) return null;
  return Math.round(wordCount / (activeMs / 60_000));
}

/**
 * Una lectura real está entre unas 40 y 700 ppm. Fuera de ese rango (pulsar «he terminado»
 * sin leer, dejar la pantalla abierta) el dato no se guarda para no falsear la media.
 */
export function isPlausibleWpm(wpm: number | null): wpm is number {
  return wpm !== null && wpm >= 40 && wpm <= 700;
}
