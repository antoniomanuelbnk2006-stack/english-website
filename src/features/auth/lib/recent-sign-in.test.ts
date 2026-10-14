import { describe, expect, it } from 'vitest';
import { RECENT_EMAIL_SIGN_IN_SECONDS, signedInByEmailRecently } from './recent-sign-in';

const now = 1_800_000_000;

describe('signedInByEmailRecently', () => {
  it.each(['otp', 'magiclink', 'recovery'])(
    'vale si se acaba de entrar con el correo (%s)',
    (method) => {
      expect(signedInByEmailRecently([{ method, timestamp: now - 30 }], now)).toBe(true);
    },
  );

  it('vale justo hasta el final del plazo, y no después', () => {
    const at = (ago: number) => [{ method: 'otp', timestamp: now - ago }];
    expect(signedInByEmailRecently(at(RECENT_EMAIL_SIGN_IN_SECONDS), now)).toBe(true);
    expect(signedInByEmailRecently(at(RECENT_EMAIL_SIGN_IN_SECONDS + 1), now)).toBe(false);
  });

  it('no vale si se entró con la contraseña', () => {
    expect(signedInByEmailRecently([{ method: 'password', timestamp: now - 5 }], now)).toBe(false);
  });

  it('basta con una entrada reciente por correo', () => {
    const amr = [
      { method: 'password', timestamp: now - 7200 },
      { method: 'otp', timestamp: now - 60 },
    ];
    expect(signedInByEmailRecently(amr, now)).toBe(true);
  });

  it('no se fía de una hora en el futuro', () => {
    expect(signedInByEmailRecently([{ method: 'otp', timestamp: now + 3600 }], now)).toBe(false);
  });

  it.each([undefined, null, 'otp', [{ method: 'otp' }], [{ timestamp: now }], {}])(
    'sin un amr que se entienda, no (%j)',
    (amr) => {
      expect(signedInByEmailRecently(amr, now)).toBe(false);
    },
  );
});
