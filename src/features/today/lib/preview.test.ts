import { describe, expect, it } from 'vitest';
import { createT, getDictionary } from '@/lib/i18n';
import { buildTodayPreview } from './preview';

const base = {
  locale: 'es' as const,
  level: 'C2' as const,
  done: 0,
  goal: 45,
  dateLabel: 'lunes, 19 de octubre',
  reviewHint: 'Nada pendiente',
};

describe('buildTodayPreview', () => {
  it('lleva lo que enseña «Hoy», con el nivel y los minutos de quien ha entrado', () => {
    const preview = buildTodayPreview({ ...base, t: createT(getDictionary('es')) });
    expect(preview).toMatchObject({
      lang: 'es',
      nav: ['Hoy', 'Escuchar', 'Leer', 'Repasar'],
      more: 'Más',
      level: 'C2',
      bars: 6,
      title: 'Hoy',
      date: 'lunes, 19 de octubre',
      levelPill: 'Tu nivel: C2',
      goalTitle: 'Objetivo 45 min',
      goalProgress: '0 de 45 min',
      goalMet: null,
      quickTitle: 'Registro rápido',
      quickRows: ['Escucha', 'Lectura'],
      quickMinutes: ['10 min', '20 min', '30 min', '60 min'],
      planTitle: 'Plan de hoy',
    });
    expect(preview.plan.map((item) => item.href)).toEqual([
      '/escuchar',
      '/leer',
      '/repasar',
      '/use-of-english',
      '/gramatica',
      '/diario',
    ]);
    // El repaso dice cuántas tarjetas tocan, como en la página.
    expect(preview.plan[2]!.hint).toBe('Nada pendiente');
  });

  it('en el idioma de la interfaz, y con el objetivo cumplido lo dice', () => {
    const preview = buildTodayPreview({
      ...base,
      t: createT(getDictionary('en')),
      locale: 'en',
      level: 'B1',
      done: 50,
    });
    expect(preview.lang).toBe('en');
    expect(preview.nav[0]).toBe('Today');
    expect(preview.bars).toBe(3);
    expect(preview.goalMet).not.toBeNull();
  });
});
