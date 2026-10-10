import { describe, expect, it } from 'vitest';
import { codePassword, FixedCode } from './fixed-code';

const PEPPER = 'un-secreto-de-prueba-suficientemente-largo';

describe('codePassword', () => {
  it('da siempre la misma contraseña para el mismo secreto, email y código', () => {
    const password = codePassword(PEPPER, 'yo@example.dev', '482913');
    expect(password).toBe(codePassword(PEPPER, 'yo@example.dev', '482913'));
    expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('no distingue mayúsculas ni espacios en el email', () => {
    expect(codePassword(PEPPER, '  Yo@Example.dev ', '482913')).toBe(
      codePassword(PEPPER, 'yo@example.dev', '482913'),
    );
  });

  it('cambia con el código, con el email y con el secreto', () => {
    const base = codePassword(PEPPER, 'yo@example.dev', '482913');
    expect(codePassword(PEPPER, 'yo@example.dev', '482914')).not.toBe(base);
    expect(codePassword(PEPPER, 'otra@example.dev', '482913')).not.toBe(base);
    expect(codePassword(`${PEPPER}!`, 'yo@example.dev', '482913')).not.toBe(base);
  });

  it('no contiene el código', () => {
    expect(codePassword(PEPPER, 'yo@example.dev', '482913')).not.toContain('482913');
  });
});

describe('FixedCode', () => {
  it('admite de 4 a 8 cifras', () => {
    for (const code of ['1234', '12345', '123456', '12345678']) {
      expect(FixedCode.safeParse(code).success).toBe(true);
    }
  });

  it('rechaza lo demás', () => {
    for (const code of ['', '123', '123456789', '12a456', ' 123456', '12 34']) {
      expect(FixedCode.safeParse(code).success).toBe(false);
    }
  });
});
