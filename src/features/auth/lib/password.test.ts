import { describe, expect, it } from 'vitest';
import { derivedPassword, generatePassword, Password } from './password';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-rules';

const PEPPER = 'un-secreto-de-prueba-suficientemente-largo';
const SECRET = 'caballo-grapa-bateria-ok';

describe('derivedPassword', () => {
  it('da siempre la misma contraseña para el mismo secreto, email y contraseña', () => {
    const password = derivedPassword(PEPPER, 'yo@example.dev', SECRET);
    expect(password).toBe(derivedPassword(PEPPER, 'yo@example.dev', SECRET));
    expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('no distingue mayúsculas ni espacios en el email', () => {
    expect(derivedPassword(PEPPER, '  Yo@Example.dev ', SECRET)).toBe(
      derivedPassword(PEPPER, 'yo@example.dev', SECRET),
    );
  });

  it('cambia con la contraseña, con el email y con el secreto', () => {
    const base = derivedPassword(PEPPER, 'yo@example.dev', SECRET);
    expect(derivedPassword(PEPPER, 'yo@example.dev', `${SECRET}!`)).not.toBe(base);
    expect(derivedPassword(PEPPER, 'otra@example.dev', SECRET)).not.toBe(base);
    expect(derivedPassword(`${PEPPER}!`, 'yo@example.dev', SECRET)).not.toBe(base);
  });

  it('en la contraseña sí cuentan las mayúsculas y los espacios', () => {
    const base = derivedPassword(PEPPER, 'yo@example.dev', SECRET);
    expect(derivedPassword(PEPPER, 'yo@example.dev', SECRET.toUpperCase())).not.toBe(base);
    expect(derivedPassword(PEPPER, 'yo@example.dev', `${SECRET} `)).not.toBe(base);
  });

  it('no contiene la contraseña', () => {
    expect(derivedPassword(PEPPER, 'yo@example.dev', SECRET)).not.toContain(SECRET);
  });
});

describe('Password', () => {
  it('admite 12 caracteres o más, con cualquier signo', () => {
    for (const password of [
      'a'.repeat(PASSWORD_MIN_LENGTH),
      SECRET,
      'Con espacios y eñes: ¡vale!',
      '123456789012',
      'x'.repeat(PASSWORD_MAX_LENGTH),
    ]) {
      expect(Password.safeParse(password).success, password).toBe(true);
    }
  });

  it('rechaza las cortas (incluido cualquier código de 4 a 8 cifras) y las desmedidas', () => {
    for (const password of [
      '',
      '1234',
      '12345678',
      'once-letras',
      'x'.repeat(PASSWORD_MAX_LENGTH + 1),
    ]) {
      expect(Password.safeParse(password).success, password).toBe(false);
    }
  });

  it('no recorta ni cambia lo que se escribe', () => {
    expect(Password.parse('  con espacios  ')).toBe('  con espacios  ');
  });
});

describe('generatePassword', () => {
  it('da cinco grupos de cuatro letras y cifras que no se confunden', () => {
    const password = generatePassword();
    expect(password).toMatch(/^([a-hjkmnp-z2-9]{4}-){4}[a-hjkmnp-z2-9]{4}$/);
    expect(Password.safeParse(password).success).toBe(true);
  });

  it('no repite', () => {
    const many = new Set(Array.from({ length: 200 }, generatePassword));
    expect(many.size).toBe(200);
  });
});
