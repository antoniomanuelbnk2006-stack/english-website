import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { E2E } from '../../playwright.config';

/** Deja la base de datos del emulador como recién creada, con el usuario de prueba. */
export async function resetDatabase(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${E2E.emulatorUrl}/__test/reset`);
  expect(response.ok()).toBe(true);
}

/** Consulta directa a la base de datos del emulador, para comprobar qué se ha guardado. */
export async function queryDatabase<T = Record<string, unknown>>(
  request: APIRequestContext,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const response = await request.post(`${E2E.emulatorUrl}/__test/query`, { data: { sql, params } });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as T[];
}

/** Marca la casilla de la política de privacidad, que hay que aceptar en cada acceso (ADR-0030). */
export async function acceptPrivacy(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /acepto la política de privacidad/ }).check();
}

/**
 * Entra con el email permitido y el código que acepta el emulador. Los textos que busca son los
 * del español: con el navegador en otro idioma, pásale `/login?lang=es` (ADR-0032).
 */
export async function signIn(page: Page, loginPath = '/login'): Promise<void> {
  await page.goto(loginPath);
  await page.getByLabel('Email').fill(E2E.email);
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Enviarme el correo' }).click();
  await page.getByLabel('Código de 6 dígitos').fill(E2E.otp);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/hoy$/);
}

/** Errores de consola y excepciones de la página; al final del test deben ser cero. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
