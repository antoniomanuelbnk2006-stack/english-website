'use client';

import { create } from 'zustand';
import { clampRate, segmentAt, type TimeRange } from './segments';

// Reproductor: un único HTMLAudioElement controlado desde aquí
// (docs/04-arquitectura/05-audio-y-reproductor.md §3). El tiempo actual NO está en el estado
// de React: cambia en cada fotograma y se reparte a quien se suscriba con `onTime`, para que
// el karaoke y la onda no vuelvan a renderizar nada.

export interface PlayerState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  playing: boolean;
  rate: number;
  duration: number;
  /** Índice del segmento que suena. */
  segmentIndex: number;
}

export const usePlayer = create<PlayerState>(() => ({
  status: 'idle',
  playing: false,
  rate: 1,
  duration: 0,
  segmentIndex: 0,
}));

type TimeListener = (time: number) => void;

let audio: HTMLAudioElement | null = null;
let segments: readonly TimeRange[] = [];
let frame = 0;
/** Si está fijado, la reproducción se detiene (o vuelve a `loopFrom`) al llegar aquí. */
let stopAt: number | null = null;
let loopFrom: number | null = null;
const listeners = new Set<TimeListener>();

function emit(time: number): void {
  for (const listener of listeners) listener(time);
  const index = segmentAt(segments, time);
  if (index !== usePlayer.getState().segmentIndex) usePlayer.setState({ segmentIndex: index });
}

/** `timeupdate` llega unas 4 veces por segundo: para cortar con precisión se mira cada fotograma. */
function tick(): void {
  if (!audio) return;
  const time = audio.currentTime;
  if (stopAt !== null && time >= stopAt - 0.03) {
    if (loopFrom !== null) {
      audio.currentTime = loopFrom;
    } else {
      audio.pause();
      audio.currentTime = Math.max(0, stopAt - 0.01);
      stopAt = null;
      emit(audio.currentTime);
      return;
    }
  }
  emit(time);
  frame = requestAnimationFrame(tick);
}

function startLoop(): void {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(tick);
}

export const player = {
  /** Prepara un audio y sus segmentos. Llamar de nuevo con otra lección sustituye al anterior. */
  load(src: string, ranges: readonly TimeRange[], rate: number): void {
    player.dispose();
    segments = ranges;
    const element = new Audio();
    // Necesario para que el service worker pueda guardar el audio de R2 y servirlo por rangos.
    element.crossOrigin = 'anonymous';
    element.preload = 'auto';
    element.preservesPitch = true;
    element.src = src;
    element.playbackRate = clampRate(rate);
    audio = element;
    usePlayer.setState({
      status: 'loading',
      playing: false,
      rate: clampRate(rate),
      duration: 0,
      segmentIndex: 0,
    });

    element.addEventListener('loadedmetadata', () => {
      usePlayer.setState({ status: 'ready', duration: element.duration });
    });
    element.addEventListener('error', () =>
      usePlayer.setState({ status: 'error', playing: false }),
    );
    element.addEventListener('play', () => {
      usePlayer.setState({ playing: true });
      startLoop();
    });
    element.addEventListener('pause', () => {
      usePlayer.setState({ playing: false });
      cancelAnimationFrame(frame);
    });
    element.addEventListener('ended', () => {
      stopAt = null;
      loopFrom = null;
      emit(element.duration);
    });
  },

  dispose(): void {
    cancelAnimationFrame(frame);
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audio = null;
    segments = [];
    stopAt = null;
    loopFrom = null;
    usePlayer.setState({ status: 'idle', playing: false, duration: 0, segmentIndex: 0 });
  },

  /** Reproduce desde donde esté, sin límite de frase. */
  play(): void {
    stopAt = null;
    loopFrom = null;
    void audio?.play().catch(() => usePlayer.setState({ playing: false }));
  },

  pause(): void {
    audio?.pause();
  },

  toggle(): void {
    if (!audio) return;
    if (audio.paused) player.play();
    else player.pause();
  },

  seek(time: number): void {
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    emit(audio.currentTime);
  },

  /** Reproduce un tramo y se detiene al final (dictado, tarjetas de audio, palabra en contexto). */
  playRange(start: number, end: number, options: { loop?: boolean } = {}): void {
    if (!audio) return;
    audio.currentTime = start;
    stopAt = end;
    loopFrom = options.loop ? start : null;
    void audio.play().catch(() => usePlayer.setState({ playing: false }));
  },

  /** Reproduce un segmento entero y se detiene al final. */
  playSegment(index: number, options: { loop?: boolean } = {}): void {
    const segment = segments[index];
    if (segment) player.playRange(segment.start, segment.end, options);
  },

  /** Salta `delta` segmentos (−1 = frase anterior, 0 = repetir, +1 = siguiente) y sigue sonando. */
  jump(delta: number): void {
    if (!audio || segments.length === 0) return;
    const current = segmentAt(segments, audio.currentTime);
    const target = Math.max(0, Math.min(segments.length - 1, current + delta));
    const segment = segments[target];
    if (!segment) return;
    stopAt = null;
    loopFrom = null;
    audio.currentTime = segment.start;
    emit(segment.start);
    void audio.play().catch(() => usePlayer.setState({ playing: false }));
  },

  setRate(rate: number): void {
    const next = clampRate(rate);
    if (audio) audio.playbackRate = next;
    usePlayer.setState({ rate: next });
  },

  time(): number {
    return audio?.currentTime ?? 0;
  },

  /** Se llama en cada fotograma mientras suena (y al saltar). Devuelve cómo darse de baja. */
  onTime(listener: TimeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
