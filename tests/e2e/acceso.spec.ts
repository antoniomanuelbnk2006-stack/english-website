import { expect, test } from '@playwright/test';
import { E2E } from '../../playwright.config';
import { expectAccessible } from './axe';
import { acceptPrivacy, queryDatabase, resetDatabase } from './session';

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
    for (const path of [
      'index.html',
      'nosotros.html',
      'contacto.html',
      'cookies.html',
      'privacidad.html',
      'styles.css',
      'app.js',
    ]) {
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

  // La presentación comparte origen con la app: lleva su propia CSP, fija (next.config.ts).
  test('la presentación lleva una CSP fija, sin marcos ni scripts de fuera, y no se rompe con ella', async ({
    page,
    request,
  }) => {
    const pages = [
      '/',
      '/landing/index.html',
      '/landing/nosotros.html',
      '/landing/contacto.html',
      '/landing/privacidad.html',
    ];
    for (const path of pages) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      const directives = (response.headers()['content-security-policy'] ?? '').split('; ');
      expect(directives, path).toEqual(
        expect.arrayContaining([
          `default-src 'self'`,
          `script-src 'self'`,
          `style-src 'self'`,
          `font-src 'self'`,
          `frame-ancestors 'none'`,
          `object-src 'none'`,
          `base-uri 'self'`,
          `form-action 'self'`,
        ]),
      );
    }

    // Con la CSP puesta, cada página sigue cargando lo suyo: ni un aviso de CSP en consola, su
    // script se ejecuta y su hoja de estilos y sus fuentes (servidas desde aquí) se aplican.
    const blocked: string[] = [];
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) blocked.push(message.text());
    });
    for (const path of pages) {
      await page.goto(path, { waitUntil: 'load' });
      await expect(page.locator('html')).toHaveClass(/\bjs\b/);
    }
    await expect(page.locator('main h1')).toHaveCSS('font-family', /Archivo/);
    const fontLoaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('1rem Archivo');
    });
    expect(fontLoaded).toBe(true);
    expect(blocked).toEqual([]);
  });

  // El formulario de contacto no tiene servidor: prepara un correo a la dirección del pie.
  test('el formulario de contacto escribe a la dirección que enseña la página', async ({
    page,
    request,
  }) => {
    await page.goto('/landing/contacto.html');
    const address = await page.locator('.foot a[href^="mailto:"]').getAttribute('href');
    expect(address).toMatch(/^mailto:[^@\s]+@[^@\s]+$/);

    await page.getByLabel('Nombre *').fill('Ana');
    await page.getByLabel('Apellidos *').fill('García');
    await page.getByLabel('Correo electrónico *').fill('ana@example.test');
    await page.getByLabel('B1').check();
    await page.getByLabel('Mensaje *').fill('Hola.');

    // ADR-0029: sin aceptar la política de privacidad no se envía. La casilla empieza sin marcar.
    const accept = page.getByRole('checkbox', {
      name: /He leído y acepto la política de privacidad/,
    });
    await expect(accept).not.toBeChecked();
    await expect(
      page.getByRole('link', { name: 'política de privacidad' }).first(),
    ).toHaveAttribute('href', '/landing/privacidad.html');
    await page.getByRole('button', { name: 'Solicitar información' }).click();
    await expect(page.locator('#nota')).toHaveText('');
    expect(await accept.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(
      true,
    );

    await accept.check();
    await page.getByRole('button', { name: 'Solicitar información' }).click();
    await expect(page.locator('#nota')).toHaveText(
      'Se abrirá tu programa de correo con el mensaje preparado.',
    );

    // Y en el script no queda ninguna dirección escrita a mano.
    const script = await (await request.get('/landing/app.js')).text();
    expect(script).not.toMatch(/mailto:[\w.-]+@/);
  });

  // ADR-0029: el pie enseña solo el nombre y el correo del responsable, y enlaza las dos políticas.
  test('el pie de cada página pública lleva el nombre y el correo, sin teléfono ni dirección', async ({
    page,
  }) => {
    for (const path of [
      '/',
      '/landing/nosotros.html',
      '/landing/contacto.html',
      '/landing/cookies.html',
      '/landing/privacidad.html',
    ]) {
      await page.goto(path);
      const foot = page.locator('footer');
      await expect(foot.getByText('Antonio Manuel Garces', { exact: true }), path).toBeVisible();
      await expect(foot.locator('a[href^="mailto:"]'), path).toHaveCount(1);
      await expect(foot.locator('a[href^="tel:"]'), path).toHaveCount(0);
      await expect(foot, path).not.toContainText('Sevilla');
      for (const [name, href] of [
        ['Política de privacidad', '/landing/privacidad.html'],
        ['Política de cookies', '/landing/cookies.html'],
      ] as const) {
        await expect(foot.getByRole('link', { name }), path).toHaveAttribute('href', href);
      }
    }
  });

  test('la política de privacidad es pública, dice quién es el responsable y se enlaza desde el acceso', async ({
    page,
  }) => {
    await page.goto('/landing/privacidad.html');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Quién es el responsable' }),
    ).toBeVisible();
    await expect(page.locator('main')).toContainText('Antonio Manuel Garces');
    await expectAccessible(page);

    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/landing/privacidad.html',
    );
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

  // El proxy solo se salta carpetas y ficheros concretos, nunca extensiones: una ruta privada
  // que «parece» una imagen pasa por él como las demás (redirige y lleva la CSP).
  test('una ruta privada que acaba en .png o .svg también pasa por el proxy', async ({
    request,
  }) => {
    for (const path of ['/leer/b2-r-001.png', '/escribir/x.svg', '/hoy.ico', '/cualquiera.jpg']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toMatch(/\/login$/);
      expect(response.headers()['content-security-policy'], path).toMatch(/'nonce-/);
    }
    // Los estáticos de verdad siguen saliendo sin sesión.
    for (const path of ['/landing/logo.png', '/favicon.ico']) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
    }
  });

  test('ninguna respuesta se deja incrustar en otra web', async ({ request }) => {
    const paths = ['/', '/login', '/hoy', '/landing/index.html', '/landing/app.js', '/favicon.ico'];
    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()['x-frame-options'], path).toBe('DENY');
      expect(response.headers()['x-content-type-options'], path).toBe('nosniff');
    }
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
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Ese email no parece válido.');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  test('un email sin acceso recibe la misma respuesta y no puede entrar', async ({ page }) => {
    await page.getByLabel('Email').fill('otra@persona.com');
    await acceptPrivacy(page);
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
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    const code = page.getByLabel('Código de 6 dígitos');
    await code.fill('123 456');
    await expect(code).toHaveValue('123456');
    await code.fill('12a3456789');
    await expect(code).toHaveValue('123456');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  // ADR-0030: la política de privacidad se acepta en cada acceso; la casilla empieza sin marcar.
  test('sin aceptar la política de privacidad no se puede entrar', async ({ page }) => {
    const privacy = page.getByRole('checkbox', { name: /acepto la política de privacidad/ });
    await expect(privacy).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'política de privacidad' })).toHaveAttribute(
      'href',
      '/landing/privacidad.html',
    );
    await page.getByLabel('Email').fill(E2E.email);
    for (const name of ['Entrar con mi contraseña', 'Enviarme el correo']) {
      await page.getByRole('button', { name }).click();
      await expect(page.locator('form').getByRole('alert')).toHaveText(
        'Para entrar, acepta la política de privacidad.',
      );
      await expect(privacy).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByLabel('Contraseña')).toHaveCount(0);
      await expect(page.getByLabel('Código de 6 dígitos')).toHaveCount(0);
    }

    await privacy.check();
    await expect(page.locator('form').getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
  });

  test('se puede completar solo con teclado y volver a cambiar el email', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.keyboard.type('otra@persona.com');
    // La casilla de la privacidad va justo después del email.
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('checkbox', { name: /acepto la política de privacidad/ }),
    ).toBeFocused();
    await page.keyboard.press('Space');
    // Con contraseña activada, como en los tests, Intro pasa a escribirla (ADR-0021).
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Contraseña')).toBeFocused();
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
    await acceptPrivacy(page);
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
    await acceptPrivacy(page);
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

// Contraseña (ADR-0026): se entra sin pedir ningún correo. En los tests está activada y el
// emulador acepta la de `E2E.password`.
test.describe('acceso con contraseña', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDatabase(request);
    await page.goto('/login');
  });

  test('la contraseña va por delante y el correo queda como respaldo', async ({ page }) => {
    await expect(page.getByText('Escribe tu email y entra con tu contraseña.')).toBeVisible();
    const buttons = page.locator('form').getByRole('button');
    await expect(buttons).toHaveText(['Entrar con mi contraseña', 'Enviarme el correo']);
    await expect(buttons.first()).toHaveAttribute('type', 'submit');
    await expectAccessible(page);

    // El correo sigue ahí: lleva al paso de siempre.
    await page.getByLabel('Email').fill(E2E.email);
    await acceptPrivacy(page);
    await buttons.last().click();
    await expect(page.getByLabel('Código de 6 dígitos')).toBeFocused();
  });

  test('entra con el email y la contraseña, sin pasar por el correo', async ({ page }) => {
    await page.getByLabel('Email').fill(E2E.email);
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
    await expect(page.getByRole('status')).toHaveText(
      `Escribe tu contraseña para entrar como ${E2E.email}.`,
    );
    const password = page.getByLabel('Contraseña');
    await expect(password).toBeFocused();
    // No se ve al escribir, y el gestor de contraseñas del navegador tiene lo que necesita:
    // el campo de contraseña y, en el mismo formulario, de quién es.
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveAttribute('autocomplete', 'current-password');
    await expect(page.locator('form input[autocomplete="username"]')).toHaveValue(E2E.email);
    await expectAccessible(page);

    await password.fill(E2E.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/(hoy|nivel)$/);
    await page.goto('/leer');
    await expect(page).toHaveURL(/\/leer$/);
  });

  test('una contraseña corta, equivocada, o la buena con otro email, no entra', async ({
    page,
    request,
  }) => {
    // Hace falta un email con buena pinta para pasar a la contraseña.
    await page.getByLabel('Email').fill('no-es-un-email');
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Ese email no parece válido.');

    await page.getByLabel('Email').fill(E2E.email);
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
    const password = page.getByLabel('Contraseña');
    const enter = page.getByRole('button', { name: 'Entrar' });
    const alert = page.locator('form').getByRole('alert');
    await expect(enter).toBeDisabled();

    // Menos de 12 caracteres no puede ser la buena: ni se envía ni cuenta como intento. Un
    // código de los de antes (de 4 a 8 cifras) ya no vale para nada.
    for (const short of ['corta', '654321', '12345678901']) {
      await password.fill(short);
      await enter.click();
      await expect(alert).toHaveText('La contraseña tiene 12 caracteres o más.');
    }
    expect(await queryDatabase(request, 'select attempts from public.login_attempts')).toEqual([]);

    await password.fill('no-es-la-contrasena');
    await enter.click();
    await expect(alert).toHaveText('La contraseña no es correcta.');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('button', { name: 'Usar otro email' }).click();
    await page.getByLabel('Email').fill('otra@persona.com');
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
    await page.getByLabel('Contraseña').fill(E2E.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(alert).toHaveText('La contraseña no es correcta.');
    await page.goto('/hoy');
    await expect(page).toHaveURL(/\/login$/);
  });
});

// Bloqueo por intentos (ADR-0024): la app cuenta cada contraseña o código que se prueba y,
// tras cinco seguidos sin acertar, deja de admitir más durante un rato.
test.describe('bloqueo por intentos fallidos', () => {
  const attempts = (request: Parameters<typeof queryDatabase>[0]) =>
    queryDatabase<{ attempts: number; locked: boolean }>(
      request,
      `select attempts, coalesce(locked_until > now(), false) as locked
       from public.login_attempts`,
    );

  test.beforeEach(async ({ request, page }) => {
    await resetDatabase(request);
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E.email);
    await acceptPrivacy(page);
    await page.getByRole('button', { name: 'Entrar con mi contraseña' }).click();
  });

  test('entrar pone la cuenta a cero', async ({ page, request }) => {
    const password = page.getByLabel('Contraseña');
    await password.fill('no-es-la-contrasena');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'La contraseña no es correcta.',
    );
    expect(await attempts(request)).toEqual([{ attempts: 1, locked: false }]);

    await password.fill(E2E.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/(hoy|nivel)$/);
    expect(await attempts(request)).toEqual([]);
  });

  test('cinco intentos fallidos cierran el acceso; el enlace del correo lo reabre', async ({
    page,
    request,
  }) => {
    const password = page.getByLabel('Contraseña');
    const alert = page.locator('form').getByRole('alert');
    const locked =
      'Demasiados intentos. Por seguridad no se puede volver a probar hasta dentro de 1 min. Mientras tanto puedes entrar con el enlace del correo.';

    for (let n = 1; n <= 5; n++) {
      await password.fill(`contrasena-mala-0${n}`);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(alert).toHaveText('La contraseña no es correcta.');
      await expect.poll(async () => (await attempts(request))[0]?.attempts).toBe(n);
    }
    expect(await attempts(request)).toEqual([{ attempts: 5, locked: true }]);

    // Cerrado también para la contraseña buena, y sin gastar otro intento.
    await password.fill(E2E.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(alert).toHaveText(locked);
    await expect(page).toHaveURL(/\/login$/);
    await expectAccessible(page);
    expect(await attempts(request)).toEqual([{ attempts: 5, locked: true }]);

    // Y para el código de 6 cifras del correo, que pasa por la misma cuenta.
    await page.getByRole('button', { name: 'Usar otro email' }).click();
    await page.getByRole('button', { name: 'Enviarme el correo' }).click();
    await expect(page.getByRole('status')).toBeVisible();
    await page.getByLabel('Código de 6 dígitos').fill(E2E.otp);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(alert).toHaveText(locked);
    expect(await attempts(request)).toEqual([{ attempts: 5, locked: true }]);

    // El enlace de ese mismo correo no pasa por la cuenta: entra y levanta el bloqueo.
    await page.goto(`/auth/confirm?code=${E2E.authCode}`);
    await expect(page).toHaveURL(/\/(hoy|nivel)$/);
    expect(await attempts(request)).toEqual([]);
  });
});
