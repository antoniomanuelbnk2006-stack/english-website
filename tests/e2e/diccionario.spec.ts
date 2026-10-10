import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Diccionario completo de consulta (ADR-0016). La app consulta Wiktionary desde el servidor;
// en los tests habla con un doble que sirve el emulador, así que nada sale de esta máquina.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

async function search(page: Page, word: string): Promise<void> {
  await page.getByLabel('Palabra o expresión en inglés').fill(word);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test('buscar una palabra que no está en el mazo y mandarla al repaso', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/palabras');
  await page
    .getByRole('link', { name: '¿No está en el mazo? Búscala en el diccionario completo' })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Diccionario completo' })).toBeVisible();
  await expect(page.getByText('Prueba con:')).toBeVisible();
  await expectAccessible(page);

  await search(page, 'serendipity');
  await expect(page).toHaveURL(/\/palabras\/buscar\?q=serendipity$/);
  await expect(page.getByRole('heading', { level: 2, name: 'serendipity' })).toBeVisible();
  await expect(page.getByText('/ˌsɛɹ.ənˈdɪp.ɪ.ti/')).toBeVisible();
  await expect(page.getByText('Fuera de las listas por nivel')).toBeVisible();

  // Traducciones por acepción, y definiciones en texto plano (sin el HTML de la fuente).
  await expect(page.getByText('serendipia, serendipidad')).toBeVisible();
  await expect(page.getByText('(a lucky discovery made by accident)')).toBeVisible();
  await expect(page.getByText('chiripa')).toBeVisible();
  await expect(page.getByText('A lucky discovery made by accident; a happy chance.')).toBeVisible();
  await expect(page.getByText('Finding that old bookshop was pure serendipity.')).toBeVisible();
  await expect(page.getByText(/color:red/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Fuente: Wiktionary/ })).toHaveAttribute(
    'href',
    'https://en.wiktionary.org/wiki/serendipity',
  );
  await expectAccessible(page);

  // Al repaso: la tarjeta la monta el servidor con lo que devuelve el diccionario.
  await page.getByRole('button', { name: 'Mandar «serendipity» al repaso' }).click();
  await expect(page.getByText('En repaso', { exact: true })).toBeVisible();
  expect(
    await queryDatabase(
      request,
      `select kind, lemma, source_segment_id, front->>'sentence' as sentence,
              front->>'surface' as surface, back->>'def_en' as def_en, back->>'def_es' as def_es
       from public.srs_cards`,
    ),
  ).toEqual([
    {
      kind: 'word',
      lemma: 'serendipity',
      source_segment_id: 'wikt:serendipity',
      sentence: 'Finding that old bookshop was pure serendipity.',
      surface: 'serendipity',
      def_en: 'A lucky discovery made by accident; a happy chance.',
      def_es: 'serendipia; chiripa',
    },
  ]);

  // Y se repasa como cualquier otra: frase delante; definición y traducción detrás.
  await page.goto('/repasar');
  await expect(page.getByText('Finding that old bookshop was pure serendipity.')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByText('A lucky discovery made by accident; a happy chance.')).toBeVisible();

  expect(errors).toEqual([]);
});

test('traducciones en subpágina, palabras sin traducción y palabras del mazo', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/palabras/buscar');

  // Las traducciones de la categoría principal están en otra página: se piden también.
  await search(page, 'run');
  await expect(page.getByText('correr')).toBeVisible();
  await expect(page.getByText('carrera')).toBeVisible();
  await expect(page.getByText('verbo', { exact: true })).toBeVisible();
  await expect(page.getByText('sustantivo', { exact: true })).toBeVisible();

  // Una forma de otra palabra remite a ella, y lo que no es inglés no se enseña.
  await search(page, 'went');
  await expect(page.getByText('simple past of go')).toBeVisible();
  await expect(page.getByText('A code.')).toHaveCount(0);
  await expect(page.getByText(/Es una forma de otra palabra/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'go', exact: true })).toHaveAttribute(
    'href',
    '/palabras/buscar?q=go',
  );

  // Sin traducción al español en la fuente: lo dice y quedan las definiciones.
  await search(page, 'gizmo');
  await expect(page.getByText(/no trae traducción al español/)).toBeVisible();
  await expect(page.getByText('A small device whose name you do not know.')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar «gizmo» como conocida' }).click();
  await expect(page.getByText('Conocida', { exact: true })).toBeVisible();
  expect(await queryDatabase(request, 'select lemma, status from public.lexicon')).toEqual([
    { lemma: 'gizmo', status: 'known' },
  ]);

  // Una palabra del mazo enseña su entrada cuidada, y es la que va al repaso.
  await search(page, 'advice');
  await expect(page.getByText('En tu mazo de B1')).toBeVisible();
  await expect(page.getByText('Can you give me some advice?')).toBeVisible();
  await page.getByRole('button', { name: 'Mandar «advice» al repaso' }).click();
  await expect(page.getByText('En repaso', { exact: true })).toBeVisible();
  expect(
    await queryDatabase(request, 'select source_segment_id from public.srs_cards order by 1'),
  ).toEqual([{ source_segment_id: 'dict:advice' }]);
  await expectAccessible(page);

  expect(errors).toEqual([]);
});

test('lo que no se encuentra, lo que no vale y el diccionario caído', async ({ page }) => {
  await signIn(page);

  // Desde el mazo, una búsqueda sin resultados ofrece el diccionario completo.
  await page.goto('/palabras?q=confortable');
  await expect(page.getByRole('heading', { name: 'Ninguna palabra coincide' })).toBeVisible();
  await page.getByRole('link', { name: 'Buscar «confortable» en el diccionario completo' }).click();

  // Existe en Wiktionary, pero no como palabra inglesa: sugiere la buena.
  await expect(page.getByRole('heading', { name: 'No encuentro «confortable»' })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('link', { name: 'comfortable', exact: true }).click();
  await expect(page).toHaveURL(/q=comfortable$/);

  await search(page, '<b>hola</b>');
  await expect(page.getByText(/Escribe una palabra o una expresión en inglés/)).toBeVisible();

  await search(page, 'boom');
  await expect(page.getByRole('heading', { name: 'El diccionario no responde' })).toBeVisible();
  await expectAccessible(page);
});
