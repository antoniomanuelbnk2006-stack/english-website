import { expect, test } from '@playwright/test';
import { E2E } from '../../playwright.config';
import { expectAccessible } from './axe';
import { resetDatabase } from './session';

// Flujos de acceso que no necesitan una sesión real (ni un Supabase detrás).

test.describe('sin sesión', () => {
  for (const path of ['/hoy', '/leer', '/escuchar', '/repasar', '/ajustes']) {
    test(`${path} redirige al acceso`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Entra en Señal' })).toBeVisible();
    });
  }

  test('la página de presentación se ve sin sesión, con sus ficheros', async ({ request }) => {
    for (const path of ['index.html', 'nosotros.html', 'contacto.html', 'styles.css', 'app.js']) {
      const response = await request.get(`/landing/${path}`, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });

  // ADR-0022: quien no ha entrado ve la presentación en «/», con su camino al acceso.
  test('la portada enseña la presentación y lleva al acceso', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Domina el Inglés con Señal' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Entrar', exact: true }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  // «Explorar A1…C2» abre el cuestionario de ese nivel (Use of English) y las secciones de la app
  // cuelgan de la presentación; sin sesión, el acceso las intercepta.
  test('la presentación enlaza el cuestionario de cada nivel y las secciones', async ({ page }) => {
    await page.goto('/landing/index.html');
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      await expect(page.getByRole('link', { name: `Explorar ${level}` })).toHaveAttribute(
        'href',
        `/use-of-english?nivel=${level}`,
      );
    }
    for (const href of ['/escuchar', '/leer', '/vocabulario', '/escribir', '/pronunciar']) {
      await expect(page.locator(`#secciones a[href="${href}"]`)).toHaveCount(1);
    }
    await page.getByRole('link', { name: 'Explorar B2' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('las rutas de API responden 401 en vez de redirigir', async ({ request }) => {
    const response = await request.get('/api/ai/writing-feedback', { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  test('la respuesta lleva una CSP con nonce y sin unsafe-inline en scripts', async ({
    request,
  }) => {
    const response = await request.get('/login');
    const csp = response.headers()['content-security-policy'] ?? '';
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(csp).toContain(`frame-ancestors 'none'`);
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  // La web tiene una sola dirección (ADR-0021). La petición llega con el nombre de otra, como
  // la dirección propia que Vercel deja a cada despliegue antiguo.
  test('lo que llega por otra dirección se redirige; lo local y la buena, no', async ({
    request,
  }) => {
    const old = { host: 'senal-abc123-equipo.vercel.app' };
    for (const path of ['/login', '/leer/b2-r-001?fase=2', '/api/ai/writing-feedback']) {
      const response = await request.get(path, { headers: old, maxRedirects: 0 });
      expect(response.status()).toBe(307);
      // Fuera de Vercel, Next cree que su dirección es la del servidor y escribe como relativa
      // una redirección a ella: aquí se ve la ruta. El destino completo lo cubren los tests de
      // `canonicalUrl`.
      expect([path, `${E2E.appUrl}${path}`]).toContain(response.headers().location);
    }

    const direct = await request.get('/login', { maxRedirects: 0 });
    expect(direct.status()).toBe(200);
    // El mismo servidor por 127.0.0.1: una dirección local nunca se redirige.
    const local = await request.get(`${E2E.appUrl.replace('localhost', '127.0.0.1')}/login`, {
      maxRedirects: 0,
    });
    expect(local.status()).toBe(200);
  });
});

test.describe('pantalla de acceso', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('es accesible y no deja errores en consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.reload({ waitUntil: 'networkidle' });
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });

  test('avisa si el email no es válido', async ({ page }) => {
    await page.getByLabel('Email').fill('no-es-un-email');
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Ese email no parece válido.');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  test('un email sin acceso recibe la misma respuesta y no puede entrar', async ({ page }) => {
    await page.getByLabel('Email').fill('otra@persona.com');
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();

    // No se revela si el email tiene acceso: se pasa igualmente al paso del código.
    await expect(page.getByRole('status')).toContainText('Si otra@persona.com tiene acceso');
    await expectAccessible(page);

    await page.getByLabel('Código de 6 dígitos').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'El código no es correcto o ha caducado. Pide uno nuevo.',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('el código admite pegar con espacios y solo conserva 6 dígitos', async ({ page }) => {
    await page.getByLabel('Email').fill('otra@persona.com');
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    const code = page.getByLabel('Código de 6 dígitos');
    await code.fill('123 456');
    await expect(code).toHaveValue('123456');
    await code.fill('12a3456789');
    await expect(code).toHaveValue('123456');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  test('se puede completar solo con teclado y volver a cambiar el email', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.keyboard.type('otra@persona.com');
    // Con código fijo activado, como en los tests, Intro pasa a escribirlo (ADR-0021).
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Código fijo')).toBeFocused();
    await page.getByRole('button', { name: 'Usar otro email' }).click();
    await expect(page.getByLabel('Email')).toHaveValue('otra@persona.com');
  });
});

// El correo de acceso puede traer un enlace en vez del código (ADR-0018): Supabase lo comprueba
// y vuelve a /auth/confirm con un código de un solo uso.
test.describe('acceso con el enlace del correo', () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase(request);
  });

  test('abre sesión en el navegador que pidió el correo', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E.email);
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    await expect(page.getByRole('status')).toContainText(
      'o abre el enlace que trae en este mismo navegador',
    );

    await page.goto(`/auth/confirm?code=${E2E.authCode}`);
    await expect(page).toHaveURL(/\/(hoy|nivel)$/);
    // La sesión es de verdad: las pantallas privadas ya no mandan al acceso.
    await page.goto('/leer');
    await expect(page).toHaveURL(/\/leer$/);
  });

  test('en otro navegador, o con un enlace que no vale, vuelve al acceso y lo explica', async ({
    page,
    browser,
  }) => {
    // Sin haber pedido el correo desde aquí no hay con qué canjear el enlace.
    await page.goto(`/auth/confirm?code=${E2E.authCode}`);
    await expect(page).toHaveURL(/\/login\?error=enlace$/);
    // (Next tiene su propio `role="alert"` para anunciar las navegaciones.)
    await expect(page.getByRole('alert').filter({ hasText: 'Ese enlace' })).toHaveText(
      'Ese enlace no es válido o ha caducado. Pide otro correo y abre el enlace en este mismo navegador.',
    );
    await expect(page.getByLabel('Email')).toBeVisible();
    await expectAccessible(page);

    // Pedido en un navegador y abierto en otro: tampoco entra.
    await page.getByLabel('Email').fill(E2E.email);
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    await expect(page.getByRole('status')).toBeVisible();
    const other = await (await browser.newContext()).newPage();
    await other.goto(`/auth/confirm?code=${E2E.authCode}`);
    await expect(other).toHaveURL(/\/login\?error=enlace$/);
    await other.context().close();

    // Un código que no es el del enlace, o ninguno.
    for (const query of ['?code=otro-codigo-cualquiera', '?code=%3Cscript%3E', '']) {
      await page.goto(`/auth/confirm${query}`);
      await expect(page).toHaveURL(/\/login\?error=enlace$/);
    }
    await page.goto('/hoy');
    await expect(page).toHaveURL(/\/login$/);
  });
});

// Código fijo (ADR-0020): se entra sin pedir ningún correo. En los tests está activado y el
// emulador acepta el código de `E2E.fixedCode`.
test.describe('acceso con código fijo', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDatabase(request);
    await page.goto('/login');
  });

  test('el código fijo va por delante y el correo queda como respaldo', async ({ page }) => {
    await expect(page.getByText('Escribe tu email y entra con tu código fijo.')).toBeVisible();
    const buttons = page.locator('form').getByRole('button');
    await expect(buttons).toHaveText(['Entrar con mi código fijo', 'Enviarme el correo']);
    await expect(buttons.first()).toHaveAttribute('type', 'submit');
    await expectAccessible(page);

    // El correo sigue ahí: lleva al paso de siempre.
    await page.getByLabel('Email').fill(E2E.email);
    await buttons.last().click();
    await expect(page.getByLabel('Código de 6 dígitos')).toBeFocused();
  });

  test('entra con el email y el código, sin pasar por el correo', async ({ page }) => {
    await page.getByLabel('Email').fill(E2E.email);
    await page.getByRole('button', { name: 'Entrar con mi código fijo' }).click();
    await expect(page.getByRole('status')).toHaveText(
      `Escribe tu código fijo para entrar como ${E2E.email}.`,
    );
    const code = page.getByLabel('Código fijo');
    await expect(code).toBeFocused();
    await expectAccessible(page);

    await code.fill(E2E.fixedCode);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/(hoy|nivel)$/);
    await page.goto('/leer');
    await expect(page).toHaveURL(/\/leer$/);
  });

  test('un código equivocado, o el bueno con otro email, no entra', async ({ page }) => {
    // Hace falta un email con buena pinta para pasar al código.
    await page.getByLabel('Email').fill('no-es-un-email');
    await page.getByRole('button', { name: 'Entrar con mi código fijo' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Ese email no parece válido.');

    await page.getByLabel('Email').fill(E2E.email);
    await page.getByRole('button', { name: 'Entrar con mi código fijo' }).click();
    const code = page.getByLabel('Código fijo');
    const enter = page.getByRole('button', { name: 'Entrar' });

    // De 4 a 8 cifras; lo que no sea una cifra se descarta.
    await code.fill('12a');
    await expect(code).toHaveValue('12');
    await expect(enter).toBeDisabled();
    await code.fill('1234567890');
    await expect(code).toHaveValue('12345678');

    await code.fill('000000');
    await enter.click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('El código no es correcto.');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('button', { name: 'Usar otro email' }).click();
    await page.getByLabel('Email').fill('otra@persona.com');
    await page.getByRole('button', { name: 'Entrar con mi código fijo' }).click();
    await page.getByLabel('Código fijo').fill(E2E.fixedCode);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('El código no es correcto.');
    await page.goto('/hoy');
    await expect(page).toHaveURL(/\/login$/);
  });
});
