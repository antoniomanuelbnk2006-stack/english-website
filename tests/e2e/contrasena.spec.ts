import { expect, test, type Page } from '@playwright/test';
import { E2E } from '../../playwright.config';
import { expectAccessible } from './axe';
import { acceptPrivacy, resetDatabase, signIn, trackErrors } from './session';

// La contraseña se pone y se cambia desde la web, en Ajustes (ADR-0031). Sin la actual solo justo
// después de entrar con el correo; si se ha olvidado, el acceso lleva hasta ahí.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

const NEW_PASSWORD = 'otra-contrasena-de-pruebas';

const field = (page: Page, name: string) => page.getByLabel(name, { exact: true });

async function signInWithPassword(page: Page, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E.email);
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
  await field(page, 'Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function signOut(page: Page): Promise<void> {
  await page.goto('/ajustes');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function setPassword(page: Page, password: string, confirm = password): Promise<void> {
  await field(page, 'Contraseña nueva').fill(password);
  await field(page, 'Repite la contraseña nueva').fill(confirm);
  await page.getByRole('button', { name: 'Guardar la contraseña' }).click();
}

const saved = (page: Page) =>
  page.getByText('Contraseña guardada. La próxima vez puedes entrar con ella.');
const error = (page: Page) => page.locator('#contrasena').getByRole('alert');

test('recién entrado con el correo, se pone sin la actual y después se entra con ella', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/ajustes');

  const panel = page.locator('#contrasena');
  await expect(panel.getByRole('heading', { name: 'Contraseña' })).toBeVisible();
  await expect(panel).toContainText('puedes poner una contraseña nueva sin escribir la anterior');
  await expect(field(page, 'Contraseña actual')).toHaveCount(0);
  await expectAccessible(page);

  // Antes de enviar nada: que sea larga y que las dos coincidan.
  await setPassword(page, 'corta');
  await expect(error(page)).toHaveText('La contraseña nueva tiene que tener 12 caracteres o más.');
  await setPassword(page, NEW_PASSWORD, `${NEW_PASSWORD}x`);
  await expect(error(page)).toHaveText('Las dos contraseñas nuevas no coinciden.');

  await setPassword(page, NEW_PASSWORD);
  await expect(saved(page)).toBeVisible();
  await expect(field(page, 'Contraseña nueva')).toHaveValue('');

  // La nueva vale para entrar; la de antes, ya no.
  await signOut(page);
  await signInWithPassword(page, E2E.password);
  await expect(page.locator('form').getByRole('alert')).toHaveText('La contraseña no es correcta.');
  await signInWithPassword(page, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/hoy$/);

  expect(errors).toEqual([]);
});

test('entrado con la contraseña, para cambiarla hace falta la actual', async ({ page }) => {
  await signInWithPassword(page, E2E.password);
  await expect(page).toHaveURL(/\/hoy$/);
  await page.goto('/ajustes');

  const current = field(page, 'Contraseña actual');
  await expect(current).toBeVisible();
  await expect(current).toHaveAttribute('autocomplete', 'current-password');
  await expect(field(page, 'Contraseña nueva')).toHaveAttribute('autocomplete', 'new-password');

  await setPassword(page, NEW_PASSWORD);
  await expect(error(page)).toHaveText('Escribe tu contraseña actual.');

  await current.fill('no-es-la-contrasena');
  await setPassword(page, NEW_PASSWORD);
  await expect(error(page)).toHaveText('La contraseña actual no es correcta.');

  await current.fill(E2E.password);
  await setPassword(page, E2E.password);
  await expect(error(page)).toHaveText('Esa ya es tu contraseña. Escribe una distinta.');

  await current.fill(E2E.password);
  await setPassword(page, NEW_PASSWORD);
  await expect(saved(page)).toBeVisible();

  await signOut(page);
  await signInWithPassword(page, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/hoy$/);
});

test('«¿Has olvidado la contraseña?» lleva, tras entrar con el correo, a poner una nueva', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E.email);
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
  await page.getByRole('button', { name: '¿Has olvidado la contraseña?' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Al entrar con ese correo irás a Ajustes, donde podrás poner una contraseña nueva sin la anterior.',
  );

  await page.getByLabel('Código de 6 dígitos').fill(E2E.otp);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/ajustes#contrasena$/);
  await expect(field(page, 'Contraseña nueva')).toBeFocused();
  await expect(field(page, 'Contraseña actual')).toHaveCount(0);

  await setPassword(page, NEW_PASSWORD);
  await expect(saved(page)).toBeVisible();

  // Solo esa vez: el siguiente acceso con el correo vuelve a llevar a Hoy.
  await signOut(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/hoy$/);
  await signOut(page);
  await signInWithPassword(page, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/hoy$/);

  expect(errors).toEqual([]);
});

test('con el enlace del correo también se llega a poner la contraseña', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E.email);
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
  await page.getByRole('button', { name: '¿Has olvidado la contraseña?' }).click();
  await expect(page.getByLabel('Código de 6 dígitos')).toBeVisible();

  await page.goto(`/auth/confirm?code=${E2E.authCode}`);
  await expect(page).toHaveURL(/\/ajustes#contrasena$/);
  await expect(field(page, 'Contraseña actual')).toHaveCount(0);
  await setPassword(page, NEW_PASSWORD);
  await expect(saved(page)).toBeVisible();
});
