import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  startOfDayMadrid,
  startOfMonthMadrid,
  startOfTodayMadrid,
  startOfWeek,
  todayMadrid,
  weekdayOf,
} from './dates';

const at = (iso: string) => new Date(iso);

describe('todayMadrid', () => {
  it('en invierno (UTC+1) el día cambia a las 23:00 UTC', () => {
    expect(todayMadrid(at('2026-01-15T22:59:59Z'))).toBe('2026-01-15');
    expect(todayMadrid(at('2026-01-15T23:00:00Z'))).toBe('2026-01-16');
  });

  it('en verano (UTC+2) el día cambia a las 22:00 UTC', () => {
    expect(todayMadrid(at('2026-07-15T21:59:59Z'))).toBe('2026-07-15');
    expect(todayMadrid(at('2026-07-15T22:00:00Z'))).toBe('2026-07-16');
  });

  it('no coincide con el día UTC justo después de medianoche en Madrid', () => {
    const now = at('2026-10-08T22:30:00Z'); // 00:30 del día 9 en Madrid
    expect(todayMadrid(now)).toBe('2026-10-09');
    expect(now.toISOString().startsWith('2026-10-08')).toBe(true);
  });
});

describe('startOfDayMadrid en los cambios de hora', () => {
  it('29 de marzo de 2026: el día empieza en UTC+1 y dura 23 horas', () => {
    const start = startOfDayMadrid('2026-03-29');
    const next = startOfDayMadrid('2026-03-30');
    expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(next.toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('25 de octubre de 2026: el día empieza en UTC+2 y dura 25 horas', () => {
    const start = startOfDayMadrid('2026-10-25');
    const next = startOfDayMadrid('2026-10-26');
    expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(next.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it('una hora repetida en el cambio de octubre sigue siendo el mismo día', () => {
    expect(todayMadrid(at('2026-10-25T00:30:00Z'))).toBe('2026-10-25'); // 02:30 CEST
    expect(todayMadrid(at('2026-10-25T01:30:00Z'))).toBe('2026-10-25'); // 02:30 CET
  });
});

describe('startOfTodayMadrid y startOfMonthMadrid', () => {
  it('devuelven el instante de las 00:00 de Madrid', () => {
    expect(startOfTodayMadrid(at('2026-10-08T15:00:00Z')).toISOString()).toBe(
      '2026-10-07T22:00:00.000Z',
    );
    expect(startOfMonthMadrid(at('2026-10-08T15:00:00Z')).toISOString()).toBe(
      '2026-09-30T22:00:00.000Z',
    );
  });

  it('el último instante UTC del mes ya es el mes siguiente en Madrid', () => {
    expect(startOfMonthMadrid(at('2026-12-31T23:30:00Z')).toISOString()).toBe(
      '2026-12-31T23:00:00.000Z',
    );
  });
});

describe('aritmética de días', () => {
  it('addDays cruza meses, años y cambios de hora', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('weekdayOf usa lunes = 1 y domingo = 7', () => {
    expect(weekdayOf('2026-10-05')).toBe(1); // lunes
    expect(weekdayOf('2026-10-08')).toBe(4); // jueves
    expect(weekdayOf('2026-10-11')).toBe(7); // domingo
  });

  it('startOfWeek devuelve el lunes', () => {
    expect(startOfWeek('2026-10-08')).toBe('2026-10-05');
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05');
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
  });

  it('daysBetween cuenta días de calendario', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('rechaza formatos que no sean YYYY-MM-DD', () => {
    expect(() => addDays('08/10/2026', 1)).toThrow(/YYYY-MM-DD/);
  });
});
