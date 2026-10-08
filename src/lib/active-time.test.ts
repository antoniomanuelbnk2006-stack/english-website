import { describe, expect, it } from 'vitest';
import { ActiveClock, isPlausibleWpm, wordsPerMinute } from './active-time';

const s = (seconds: number) => seconds * 1000;

describe('ActiveClock', () => {
  it('cuenta el tiempo mientras hay interacción reciente', () => {
    const clock = new ActiveClock(0);
    clock.interact(s(10));
    clock.interact(s(40));
    expect(clock.totalMs(s(50))).toBe(s(50));
  });

  it('deja de contar a los 60 s de la última interacción', () => {
    const clock = new ActiveClock(0);
    clock.interact(s(20));
    // Sin tocar nada durante 5 minutos: solo cuentan los 60 s de margen.
    expect(clock.totalMs(s(320))).toBe(s(80));
    clock.interact(s(320));
    expect(clock.totalMs(s(330))).toBe(s(90));
  });

  it('con audio sonando cuenta aunque no se toque nada', () => {
    const clock = new ActiveClock(0);
    clock.setPlaying(true, 0);
    expect(clock.totalMs(s(180))).toBe(s(180));
    clock.setPlaying(false, s(180));
    // Al parar, el margen de 60 s empieza de nuevo.
    expect(clock.totalMs(s(400))).toBe(s(240));
  });

  it('no cuenta nada con la pestaña oculta', () => {
    const clock = new ActiveClock(0);
    clock.interact(s(5));
    clock.setPaused(true, s(10));
    expect(clock.totalMs(s(500))).toBe(s(10));
    clock.setPaused(false, s(500));
    expect(clock.totalMs(s(520))).toBe(s(30));
  });

  it('take devuelve el incremento y vuelve a cero', () => {
    const clock = new ActiveClock(0);
    clock.interact(s(30));
    expect(clock.take(s(30))).toBe(s(30));
    clock.interact(s(45));
    expect(clock.take(s(45))).toBe(s(15));
    expect(clock.take(s(45))).toBe(0);
  });

  it('ignora relojes que retroceden', () => {
    const clock = new ActiveClock(s(100));
    clock.interact(s(90));
    expect(clock.totalMs(s(95))).toBe(0);
  });
});

describe('wordsPerMinute', () => {
  it('calcula palabras por minuto de lectura activa', () => {
    expect(wordsPerMinute(386, s(171))).toBe(135);
    expect(wordsPerMinute(300, s(120))).toBe(150);
  });

  it('no calcula nada sin palabras o sin tiempo', () => {
    expect(wordsPerMinute(0, s(60))).toBeNull();
    expect(wordsPerMinute(386, 500)).toBeNull();
  });

  it('descarta velocidades imposibles', () => {
    expect(isPlausibleWpm(135)).toBe(true);
    expect(isPlausibleWpm(wordsPerMinute(386, s(3)))).toBe(false);
    expect(isPlausibleWpm(wordsPerMinute(386, s(3600)))).toBe(false);
    expect(isPlausibleWpm(null)).toBe(false);
  });
});
