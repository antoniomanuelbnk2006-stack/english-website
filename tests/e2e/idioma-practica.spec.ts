import { expect, test } from '@playwright/test';
import { E2E } from '../../playwright.config';
import { expectAccessible } from './axe';
import { acceptPrivacy, queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// El idioma que se practica (ADR-0036). El contenido de prueba tiene inglés y una ficha de
// español: cada sección enseña solo lo del idioma elegido, y las ayudas siguen en el idioma de
// la interfaz (o en inglés, si no están en el de la interfaz).

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

const practiceLanguage = async (request: Parameters<typeof queryDatabase>[0]) =>
  queryDatabase(request, "select settings->>'practice_language' as language from public.profiles");

test('se elige en Ajustes y cada sección enseña solo ese idioma', async ({ page, request }) => {
  const errors = trackErrors(page);
  await signIn(page);

  // Sin elegir, se practica inglés.
  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: /Present simple/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ser y estar/ })).toHaveCount(0);

  await page.goto('/ajustes');
  const practice = page.getByLabel('Idioma que practicas');
  await expect(practice).toHaveValue('en');
  await expect(practice.getByRole('option')).toHaveText(['Inglés', 'Español']);
  await expectAccessible(page);
  await practice.selectOption('es');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Ajustes guardados.')).toBeVisible();
  expect(await practiceLanguage(request)).toEqual([{ language: 'es' }]);

  // Gramática: solo la ficha de español. Su cuerpo y sus ayudas están en inglés, porque en
  // español (el idioma de la interfaz) no los tiene.
  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: /Present simple/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Ser y estar/ }).click();
  await expect(page).toHaveURL(/\/gramatica\/es\.a1\.ser-estar$/);
  await expect(page.getByRole('heading', { name: 'In one sentence' })).toBeVisible();
  await expect(page.getByText('Soy de Madrid.')).toBeVisible();
  await expect(page.getByText('I am from Madrid.')).toBeVisible();
  await expectAccessible(page);

  // Use of English y Pronunciación también tienen ejercicios en español, sin los de inglés.
  await page.goto('/use-of-english?nivel=todos');
  await expect(page.getByRole('link', { name: /Me presento/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /My family/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Me presento/ }).click();
  await expect(page).toHaveURL(/\/use-of-english\/es-a1-uoe-001$/);
  await expect(page.locator('[lang="es"]', { hasText: 'Hola,' }).first()).toBeVisible();
  await page.goto('/pronunciar?nivel=todos');
  await expect(page.getByRole('link', { name: /R and RR/ })).toBeVisible();
  await page.getByRole('link', { name: /R and RR/ }).click();
  await expect(page).toHaveURL(/\/pronunciar\/es-a1-pro-002$/);
  await expect(page.locator('p[lang="es"]', { hasText: 'pero' }).first()).toBeVisible();
  // El acento británico/americano es solo del inglés.
  await expect(page.getByText('Acento')).toHaveCount(0);

  await page.goto('/escribir?nivel=A1');
  await expect(page.getByRole('link', { name: /Un mensaje a un compañero nuevo/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /A friend is visiting your city/ })).toHaveCount(0);
  await page.goto('/leer?nivel=todos');
  await expect(page.getByRole('link', { name: /The Second Life of Old Games/ })).toHaveCount(0);

  // Se vuelve al inglés y todo está donde estaba.
  await page.goto('/ajustes');
  await page.getByLabel('Idioma que practicas').selectOption('en');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Ajustes guardados.')).toBeVisible();
  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: /Present simple/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ser y estar/ })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('con la interfaz en francés, la ficha de español trae sus ayudas en francés', async ({
  page,
  request,
}) => {
  await queryDatabase(
    request,
    `update public.profiles set ui_locale = 'fr', settings = settings || '{"practice_language":"es"}'`,
  );
  // Ya eligió su nivel de español: si no, «Hoy» le llevaría a elegirlo (ADR-0037).
  await queryDatabase(
    request,
    `insert into public.language_levels (user_id, language, declared_level)
     select id, 'es', 'A1' from public.profiles`,
  );
  await signIn(page);
  await page.goto('/gramatica/es.a1.ser-estar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByText('Je suis de Madrid.')).toBeVisible();
  // El segundo ejemplo solo tiene la traducción en inglés: sale esa.
  await expect(page.getByText('I am at home.')).toBeVisible();
});

test('en el primer acceso se elige el idioma antes que el nivel', async ({ page, request }) => {
  const errors = trackErrors(page);
  await queryDatabase(request, 'delete from public.language_levels');
  // Sin nivel, entrar lleva a elegirlo (no a Hoy, que es donde acaba `signIn`).
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E.email);
  await acceptPrivacy(page);
  await page.getByRole('button', { name: 'Enviarme el correo' }).click();
  await page.getByLabel('Código de 6 dígitos').fill(E2E.otp);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/nivel$/);

  const languages = page.getByRole('group', { name: '¿Qué idioma quieres practicar?' });
  const levels = page.getByRole('group', { name: 'Elige tu nivel' });
  // Lo que hay de cada nivel cambia con el idioma: de español hay en A1 una ficha, una lectura, una escucha y un ejercicio de Use of English.
  await languages.getByRole('radio', { name: 'Español' }).check();
  await expect(levels.getByText('4 contenidos', { exact: true })).toBeVisible();
  await levels.getByRole('radio', { name: /A1/ }).check();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Guardar nivel' }).click();
  await expect(page).toHaveURL(/\/hoy$/);
  expect(
    await queryDatabase(
      request,
      `select l.language, l.declared_level, p.settings->>'practice_language' as practice
       from public.language_levels l, public.profiles p`,
    ),
  ).toEqual([{ language: 'es', declared_level: 'A1', practice: 'es' }]);

  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: /Ser y estar/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('cada idioma tiene su nivel: al cambiar de idioma se elige el suyo, y el otro se conserva', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  // Parte de inglés B1 (el usuario de prueba).
  await expect(page.getByRole('link', { name: /Tu nivel: B1/ })).toBeVisible();

  await page.goto('/ajustes');
  await page.getByLabel('Idioma que practicas').selectOption('es');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Ajustes guardados.')).toBeVisible();

  // De español aún no tiene nivel: «Hoy» le lleva a elegirlo, con el español ya marcado.
  await page.goto('/hoy');
  await expect(page).toHaveURL(/\/nivel$/);
  const languages = page.getByRole('group', { name: '¿Qué idioma quieres practicar?' });
  await expect(languages.getByRole('radio', { name: 'Español' })).toBeChecked();
  await page.getByRole('radio', { name: /A1/ }).check();
  await page.getByRole('button', { name: 'Guardar nivel' }).click();
  await expect(page).toHaveURL(/\/hoy$/);
  await expect(page.getByRole('link', { name: /Tu nivel: A1/ })).toBeVisible();

  // Los dos niveles conviven.
  expect(
    await queryDatabase(
      request,
      'select language, declared_level from public.language_levels order by language',
    ),
  ).toEqual([
    { language: 'en', declared_level: 'B1' },
    { language: 'es', declared_level: 'A1' },
  ]);

  // Al volver a inglés, su nivel sigue siendo el de antes.
  await page.goto('/ajustes');
  await page.getByLabel('Idioma que practicas').selectOption('en');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Ajustes guardados.')).toBeVisible();
  await page.goto('/hoy');
  await expect(page.getByRole('link', { name: /Tu nivel: B1/ })).toBeVisible();
  expect(errors).toEqual([]);
});

/** Deja al usuario de prueba practicando español, con su nivel de español ya elegido. */
async function practiceSpanish(request: Parameters<typeof queryDatabase>[0]) {
  await queryDatabase(
    request,
    `update public.profiles set settings = settings || '{"practice_language":"es"}'`,
  );
  await queryDatabase(
    request,
    `insert into public.language_levels (user_id, language, declared_level)
     select id, 'es', 'A1' from public.profiles`,
  );
}

test('un writing en español: su idioma en la pantalla y una revisión sin reglas de inglés', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await practiceSpanish(request);
  await signIn(page);
  await page.goto('/escribir');
  await page.getByRole('link', { name: /Un mensaje a un compañero nuevo/ }).click();
  await expect(page).toHaveURL(/\/escribir\/es-a1-wri-001$/);
  // La consigna y el campo de texto son de español, no de inglés.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Un mensaje a un compañero nuevo' }),
  ).toHaveAttribute('lang', 'es');
  await expect(page.getByText('Escribe un mensaje a tu compañero Leo.')).toHaveAttribute(
    'lang',
    'es',
  );
  const editor = page.getByLabel('Tu texto', { exact: true });
  await expect(editor).toHaveAttribute('lang', 'es');
  await expectAccessible(page);

  await editor.fill(
    [
      'Hola, Leo:',
      '',
      'Me llamo Marta y soy de Sevilla, en España. Tengo veinticuatro años. Trabajo en una librería pequeña. En mi tiempo libre me gusta leer y jugar al tenis con mis amigos.',
      '',
      '¡Hasta pronto!',
      'Marta',
    ].join('\n'),
  );
  await page.getByRole('button', { name: 'Revisar sin IA' }).click();
  await expect(page.getByRole('heading', { name: 'Revisión sin IA' })).toBeVisible();
  // Solo la longitud: el saludo, la despedida y los conectores se comprueban con listas de inglés.
  await expect(page.getByText('Longitud: 36 palabras (se piden 25–50).').first()).toBeVisible();
  await expect(
    page.getByText(
      /Empieza con un saludo|Falta el saludo|Tiene despedida|Falta la despedida|Conectores distintos|Vocabulario variado/,
    ),
  ).toHaveCount(0);
  expect(errors.filter((message) => !message.includes('404'))).toEqual([]);
});

test('el mazo de español: sus palabras, con su idioma y la traducción en inglés si no hay otra', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await practiceSpanish(request);
  await signIn(page);
  await page.goto('/palabras');
  const list = page.getByRole('list', { name: 'Palabras de nivel A1' });
  await expect(list.getByRole('listitem')).toHaveCount(40);
  const hola = list.getByRole('listitem').filter({ hasText: 'abrir' }).first();
  await expect(hola.locator('[lang="es"]').first()).toBeVisible();
  // La interfaz está en español y la palabra no trae traducción al español: sale la inglesa.
  await expect(hola).toContainText('to open');
  await expect(
    page.locator('[lang="en"]').filter({ hasText: 'Hola, me llamo Pablo.' }),
  ).toHaveCount(0);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('una lectura y una escucha en español: su idioma en pantalla y sus hablantes', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await practiceSpanish(request);
  await signIn(page);

  // Las bibliotecas solo enseñan lo de español.
  await page.goto('/leer');
  await expect(page.getByRole('link', { name: /The Second Life of Old Games/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Un mensaje para Leo/ }).click();
  await expect(page).toHaveURL(/\/leer\/es-a1-rea-001$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Un mensaje para Leo' }),
  ).toHaveAttribute('lang', 'es');
  await page.getByRole('button', { name: 'Empezar el vistazo' }).click();
  await expect(
    page.locator('[lang="es"]').filter({ hasText: 'Soy de Sevilla, en España.' }).first(),
  ).toBeVisible();
  await expect(page.locator('[lang="en"]').filter({ hasText: 'Soy de Sevilla' })).toHaveCount(0);
  await expectAccessible(page);

  // La escucha: hablantes de España, no de los acentos del inglés.
  await page.goto('/escuchar');
  await expect(page.getByRole('link', { name: /Un café y un bocadillo/ })).toContainText('es-ES');
  await page.getByRole('link', { name: /Un café y un bocadillo/ }).click();
  await expect(page).toHaveURL(/\/escuchar\/es-a1-lis-001$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Un café y un bocadillo' }),
  ).toHaveAttribute('lang', 'es');
  await expect(page.getByText('Ana · es-ES')).toBeVisible();
  await expect(page.getByText('Luis · es-ES')).toBeVisible();
  await expectAccessible(page);
  expect(errors.filter((message) => !message.includes('404'))).toEqual([]);
});

test('no se puede elegir un idioma sin contenido', async ({ page, request }) => {
  // Si en la base de datos hay uno que no tiene contenido, se practica inglés.
  await queryDatabase(
    request,
    `update public.profiles set settings = settings || '{"practice_language":"ja"}'`,
  );
  await signIn(page);
  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: /Present simple/ })).toBeVisible();
  await page.goto('/ajustes');
  await expect(page.getByLabel('Idioma que practicas')).toHaveValue('en');
});
