import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { acceptPrivacy, resetDatabase, signIn, trackErrors } from './session';

// Consentimiento de cookies (ADR-0028). El resto de tests arranca con las cookies aceptadas
// (playwright.config.ts); estos empiezan como una visita nueva: sin ninguna decisión.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

const banner = (page: Page) => page.getByRole('region', { name: 'Cookies' });

async function cookie(page: Page, name: string): Promise<string | undefined> {
  return (await page.context().cookies()).find((item) => item.name === name)?.value;
}

const storedAccent = (page: Page) =>
  page.evaluate(() => window.localStorage.getItem('senal:accent'));

/**
 * ¿Se recuerda la sesión al cerrar el navegador? (ADR-0030). `true` si sus cookies caducan dentro
 * de casi 400 días; `false` si no tienen caducidad y el navegador las borra al cerrarse.
 */
async function sessionRemembered(page: Page): Promise<boolean> {
  const session = (await page.context().cookies()).filter((item) =>
    /^sb-.+-auth-token(\.\d+)?$/.test(item.name),
  );
  expect(session.length).toBeGreaterThan(0);
  const inAYear = Date.now() / 1000 + 365 * 24 * 60 * 60;
  if (session.every((item) => item.expires > inAYear)) return true;
  expect(session.every((item) => item.expires === -1)).toBe(true);
  return false;
}

/** Cerrar el navegador y volver a abrirlo: solo quedan las cookies que tienen caducidad. */
async function restartBrowser(page: Page): Promise<void> {
  const context = page.context();
  const kept = (await context.cookies()).filter((item) => item.expires !== -1);
  await context.clearCookies();
  await context.addCookies(kept);
}

const privacy = (page: Page) =>
  page.getByRole('checkbox', { name: /acepto la política de privacidad/ });

/** El aviso flota entero dentro de la pantalla y, en el móvil, por encima de la barra de la app. */
async function expectFloating(page: Page): Promise<void> {
  await expect(banner(page)).toHaveCSS('position', 'fixed');
  await expect(banner(page)).toBeInViewport({ ratio: 1 });
  const nav = page.locator('[data-bottom-nav]');
  if (!(await nav.isVisible())) return;
  const [box, bar] = [await banner(page).boundingBox(), await nav.boundingBox()];
  expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
}

test('el aviso deja rechazar o aceptar con el mismo peso y no impide usar la página', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/login');

  await expect(banner(page)).toBeVisible();
  await expectFloating(page);
  const reject = banner(page).getByRole('button', { name: 'Rechazar' });
  const accept = banner(page).getByRole('button', { name: 'Aceptar' });
  // Mismo botón para las dos respuestas: ninguna va destacada.
  expect(await reject.getAttribute('class')).toBe(await accept.getAttribute('class'));
  await expect(banner(page).getByRole('link', { name: 'Más información' })).toHaveAttribute(
    'href',
    '/landing/cookies.html',
  );
  await expectAccessible(page);

  // Sin decidir no hay nada guardado, y la página se puede usar igual: en un móvil pequeño el
  // aviso cae sobre los botones del acceso, pero la página se puede subir por encima de él.
  expect(await page.context().cookies()).toEqual([]);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByLabel('Email').fill('alguien@example.com');
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  await expectFloating(page);

  expect(errors).toEqual([]);
});

test('al rechazar no se guardan preferencias: el tema y el idioma salen del perfil', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/login');
  await banner(page).getByRole('button', { name: 'Rechazar' }).click();
  await expect(banner(page)).toBeHidden();
  expect(await cookie(page, 'senal_consent')).toBe('v1.necessary');

  // La decisión se recuerda: no se vuelve a preguntar.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Entra en Señal' })).toBeVisible();
  await expect(banner(page)).toBeHidden();

  await signIn(page);
  await expect(banner(page)).toBeHidden();
  // La sesión no se recuerda: dura lo que el navegador abierto.
  expect(await sessionRemembered(page)).toBe(false);

  // El acento elegido vale para la visita, pero no se guarda en el navegador.
  await page.goto('/pronunciar/libre?texto=hello');
  await page.getByText('Americano', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Americano' })).toBeChecked();
  expect(await storedAccent(page)).toBeNull();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Británico' })).toBeChecked();

  // El tema y el idioma se guardan en el perfil y se aplican sin cookies.
  await page.goto('/ajustes');
  await page.getByLabel('Tema', { exact: true }).selectOption('light');
  await page.getByLabel('Idioma de la interfaz').selectOption('en');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await cookie(page, 'senal_theme')).toBeUndefined();
  expect(await cookie(page, 'senal_locale')).toBeUndefined();

  await page.goto('/hoy');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectAccessible(page);

  // Al cerrar el navegador y volver, hay que entrar otra vez y volver a aceptar la privacidad.
  // La decisión sobre las cookies sí se recuerda: no se vuelve a preguntar.
  await restartBrowser(page);
  await page.goto('/hoy');
  await expect(page).toHaveURL(/\/login$/);
  await expect(privacy(page)).not.toBeChecked();
  await expect(banner(page)).toBeHidden();
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('sin decidir tampoco se guardan, y el aviso sigue ahí', async ({ page }) => {
  await signIn(page);
  await expect(banner(page)).toBeVisible();
  await expectFloating(page);

  await page.goto('/ajustes');
  await page.getByLabel('Tema', { exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await cookie(page, 'senal_theme')).toBeUndefined();
  expect(await cookie(page, 'senal_locale')).toBeUndefined();
  await expect(banner(page)).toBeVisible();

  // Sin decidir, la sesión tampoco se recuerda. Al aceptar desde el aviso, pasa a recordarse.
  expect(await sessionRemembered(page)).toBe(false);
  await banner(page).getByRole('button', { name: 'Aceptar' }).click();
  await expect.poll(() => sessionRemembered(page)).toBe(true);
});

test('al aceptar se guardan, y al cambiar de opinión en Ajustes se borran', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/login');
  await banner(page).getByRole('button', { name: 'Aceptar' }).click();
  await expect(banner(page)).toBeHidden();
  expect(await cookie(page, 'senal_consent')).toBe('v1.all');

  await signIn(page);
  expect(await sessionRemembered(page)).toBe(true);
  await page.goto('/pronunciar/libre?texto=hello');
  await page.getByText('Americano', { exact: true }).click();
  expect(await storedAccent(page)).toBe('en-US');

  await page.goto('/ajustes');
  await page.getByLabel('Tema', { exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await cookie(page, 'senal_theme')).toBe('light');
  expect(await cookie(page, 'senal_locale')).toBe('es');

  // En Ajustes se ve la decisión y se cambia con un toque.
  const choices = page.getByRole('group', { name: 'Cookies' });
  const all = choices.getByRole('button', { name: 'Necesarias y de preferencias' });
  const necessary = choices.getByRole('button', { name: 'Solo las necesarias' });
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(necessary).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('link', { name: 'Política de cookies' })).toHaveAttribute(
    'href',
    '/landing/cookies.html',
  );

  await necessary.click();
  await expect(page.getByText('Hecho: solo se usan las cookies necesarias.')).toBeVisible();
  await expect(necessary).toHaveAttribute('aria-pressed', 'true');
  expect(await cookie(page, 'senal_consent')).toBe('v1.necessary');
  expect(await cookie(page, 'senal_theme')).toBeUndefined();
  expect(await cookie(page, 'senal_locale')).toBeUndefined();
  expect(await storedAccent(page)).toBeNull();
  // La sesión abierta deja de recordarse en el momento, sin esperar a que se renueve.
  await expect.poll(() => sessionRemembered(page)).toBe(false);
  // El tema no se pierde: sigue saliendo del perfil.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectAccessible(page);

  // Y se puede volver a aceptar.
  await page
    .getByRole('group', { name: 'Cookies' })
    .getByRole('button', { name: 'Necesarias y de preferencias' })
    .click();
  await expect(page.getByText('Hecho: también se usan las cookies de preferencias.')).toBeVisible();
  expect(await cookie(page, 'senal_consent')).toBe('v1.all');

  // Y vuelve a recordarse: al cerrar el navegador y volver, sigue dentro.
  await expect.poll(() => sessionRemembered(page)).toBe(true);
  await restartBrowser(page);
  await page.goto('/hoy');
  await expect(page).toHaveURL(/\/hoy$/);

  expect(errors).toEqual([]);
});

test('la portada pregunta lo mismo y la decisión vale para toda la web', async ({ page }) => {
  const blocked: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) blocked.push(message.text());
  });

  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await expectFloating(page);
  const reject = banner(page).getByRole('button', { name: 'Rechazar' });
  const accept = banner(page).getByRole('button', { name: 'Aceptar' });
  expect(await reject.getAttribute('class')).toBe(await accept.getAttribute('class'));
  await expectAccessible(page);

  await reject.click();
  await expect(banner(page)).toBeHidden();
  expect(await cookie(page, 'senal_consent')).toBe('v1.necessary');

  // La app ya no pregunta.
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Entra en Señal' })).toBeVisible();
  await expect(banner(page)).toBeHidden();

  // Desde el pie de la portada se puede cambiar de opinión.
  await page.goto('/landing/contacto.html');
  await expect(banner(page)).toBeHidden();
  await page.getByRole('button', { name: 'Configurar cookies' }).click();
  await expect(banner(page).getByRole('button', { name: 'Rechazar' })).toBeFocused();
  await banner(page).getByRole('button', { name: 'Aceptar' }).click();
  await expect(banner(page)).toBeHidden();
  expect(await cookie(page, 'senal_consent')).toBe('v1.all');

  expect(blocked).toEqual([]);
});

test('la política de cookies es pública, dice lo que hay y deja cambiar la decisión', async ({
  page,
  request,
}) => {
  expect((await request.get('/landing/cookies.html', { maxRedirects: 0 })).status()).toBe(200);

  const errors = trackErrors(page);
  await page.goto('/landing/cookies.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Política de cookies' })).toBeVisible();
  // Las cookies y la clave de almacenamiento local que usa la web, por su nombre.
  for (const name of [
    'sb-…-auth-token',
    'sb-…-code-verifier',
    'senal_consent',
    'senal_theme',
    'senal_locale',
    'senal:accent',
  ]) {
    await expect(page.getByRole('rowheader', { name, exact: true })).toBeVisible();
  }

  const state = page.locator('[data-cookie-state]');
  await expect(state).toHaveText('todavía no has elegido.');
  const necessary = page.getByRole('button', { name: 'Solo las necesarias' });
  await necessary.click();
  await expect(state).toHaveText('solo las necesarias.');
  await expect(necessary).toHaveAttribute('aria-pressed', 'true');
  await expect(banner(page)).toBeHidden();
  expect(await cookie(page, 'senal_consent')).toBe('v1.necessary');

  await page.getByRole('button', { name: 'Necesarias y de preferencias' }).click();
  await expect(state).toHaveText('necesarias y de preferencias.');
  expect(await cookie(page, 'senal_consent')).toBe('v1.all');
  await expectAccessible(page);

  expect(errors).toEqual([]);
});
