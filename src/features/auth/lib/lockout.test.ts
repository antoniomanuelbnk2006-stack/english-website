import { describe, expect, it } from 'vitest';
import { lockWait } from './lockout';

describe('lockWait', () => {
  it('cuenta en minutos, redondeando hacia arriba', () => {
    expect(lockWait(60)).toEqual({ unit: 'minutes', n: 1 });
    expect(lockWait(61)).toEqual({ unit: 'minutes', n: 2 });
    expect(lockWait(16 * 60)).toEqual({ unit: 'minutes', n: 16 });
    expect(lockWait(64 * 60)).toEqual({ unit: 'minutes', n: 64 });
  });

  it('nunca dice menos de un minuto', () => {
    expect(lockWait(0)).toEqual({ unit: 'minutes', n: 1 });
    expect(lockWait(1)).toEqual({ unit: 'minutes', n: 1 });
  });

  it('desde dos horas cuenta en horas, también hacia arriba', () => {
    expect(lockWait(119 * 60)).toEqual({ unit: 'minutes', n: 119 });
    expect(lockWait(120 * 60)).toEqual({ unit: 'hours', n: 2 });
    expect(lockWait(128 * 60)).toEqual({ unit: 'hours', n: 3 });
    expect(lockWait(24 * 3600)).toEqual({ unit: 'hours', n: 24 });
  });
});
