import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Mazo de palabras por nivel (ADR-0015) sobre el mazo de prueba: cinco palabras de B1 y dos de
// B2. Explorar, buscar, mandar al repaso, dar por conocida y estudiar una tanda.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('explorar el mazo: nivel, búsqueda, estados y acciones', async ({ page, request }) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/palabras');

  // Sin nivel en la URL se ve el del usuario (B1), con todo por aprender.
  await expect(page.getByRole('heading', { level: 1, name: 'Palabras' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Palabras de nivel B1' });
  await expect(list.getByRole('listitem')).toHaveCount(5);
  await expect(
    page.getByRole('img', { name: 'De 5 palabras de B1, conoces 0 y tienes 0 en repaso' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Estudiar 5 palabras' })).toBeVisible();
  await expectAccessible(page);

  // Cada palabra enseña su categoría, su traducción y su ejemplo.
  const advice = list.getByRole('listitem').filter({ hasText: 'advice' });
  await expect(advice).toContainText('sustantivo');
  await expect(advice).toContainText('consejo');
  await expect(advice).toContainText('Can you give me some advice?');

  // Se busca en inglés por el principio y en español sin tildes.
  await page.getByRole('searchbox', { name: 'Buscar en inglés o en español' }).fill('consejo');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(/q=consejo/);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar en inglés o en español' }).fill('zzz');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('heading', { name: 'Ninguna palabra coincide' })).toBeVisible();
  await page.getByRole('link', { name: 'Quitar filtros' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(5);

  // Al repaso: crea la tarjeta con el ejemplo delante y la traducción detrás.
  await page.getByRole('button', { name: 'Mandar «advice» al repaso' }).click();
  await expect(advice.getByText('En repaso')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mandar «advice» al repaso' })).toHaveCount(0);
  expect(
    await queryDatabase(
      request,
      `select kind, lemma, source_segment_id, front->>'sentence' as sentence,
              back->>'def_es' as def_es
       from public.srs_cards`,
    ),
  ).toEqual([
    {
      kind: 'word',
      lemma: 'advice',
      source_segment_id: 'dict:advice',
      sentence: 'Can you give me some advice?',
      def_es: 'consejo',
    },
  ]);

  // Ya la sé: queda como conocida y se puede deshacer.
  await page.getByRole('button', { name: 'Marcar «although» como conocida' }).click();
  const although = list.getByRole('listitem').filter({ hasText: 'although' });
  await expect(although.getByText('Conocida')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'De 5 palabras de B1, conoces 1 y tienes 1 en repaso' }),
  ).toBeVisible();
  expect(
    await queryDatabase(request, 'select lemma, status from public.lexicon order by lemma'),
  ).toEqual([
    { lemma: 'advice', status: 'learning' },
    { lemma: 'although', status: 'known' },
  ]);

  // Los filtros por estado.
  await page.getByRole('link', { name: 'Conocidas', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('although');
  await page.getByRole('button', { name: 'Marcar «although» como no conocida' }).click();
  await expect(page.getByRole('heading', { name: 'Ninguna palabra coincide' })).toBeVisible();
  await page.getByRole('link', { name: 'Por aprender', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(4);

  // Otro nivel.
  await page.getByRole('link', { name: /^B2/ }).click();
  await expect(page.getByRole('list', { name: 'Palabras de nivel B2' })).toContainText('absurd');
  await expect(page.getByRole('link', { name: 'Estudiar 2 palabras' })).toBeVisible();
  await expectAccessible(page);

  expect(errors).toEqual([]);
});

test('estudiar una tanda: lo que no se sabe va al repaso y se repasa', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/palabras');
  await page.getByRole('link', { name: 'Estudiar 5 palabras' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Estudiar palabras' })).toBeVisible();

  // Primero las más frecuentes: achieve (500), avoid (700), advice (900) y luego el resto.
  await expect(page.getByText('Palabra 1 de 5')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'achieve' })).toBeVisible();
  await expect(page.getByText('lograr, conseguir')).toHaveCount(0);
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Ver la traducción' }).click();
  await expect(page.getByText('lograr, conseguir')).toBeVisible();
  await expect(page.getByText('She worked hard to achieve her goal.')).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'No la sabía: al repaso' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'avoid' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la traducción' }).click();
  await page.getByRole('button', { name: 'La sabía', exact: true }).click();

  // Con la traducción a la vista, 1, 2 y 3 responden desde el teclado.
  await expect(page.getByRole('heading', { level: 2, name: 'advice' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la traducción' }).click();
  await page.keyboard.press('1');
  await expect(page.getByRole('heading', { level: 2, name: 'although' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la traducción' }).click();
  await page.keyboard.press('3');
  await expect(page.getByRole('heading', { level: 2, name: 'attend' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver la traducción' }).click();
  await page.keyboard.press('2');

  await expect(page.getByRole('heading', { name: 'Tanda terminada' })).toBeVisible();
  await expect(page.getByText('2 al repaso · 2 que ya sabías')).toBeVisible();
  expect(
    await queryDatabase(request, 'select lemma, status from public.lexicon order by lemma'),
  ).toEqual([
    { lemma: 'achieve', status: 'learning' },
    { lemma: 'advice', status: 'learning' },
    { lemma: 'although', status: 'ignored' },
    { lemma: 'attend', status: 'known' },
    { lemma: 'avoid', status: 'known' },
  ]);

  // No queda nada: otra tanda lo dice.
  await page.getByRole('button', { name: 'Otra tanda' }).click();
  await expect(
    page.getByRole('heading', { name: 'No queda nada por estudiar en B1' }),
  ).toBeVisible();

  // Las dos palabras están en el repaso: delante la frase, detrás la traducción.
  await page.goto('/repasar');
  await expect(
    page.getByText(/She worked hard to achieve her goal\.|Can you give me some advice\?/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByText(/^(lograr, conseguir|consejo)$/)).toBeVisible();
  await expectAccessible(page);

  expect(errors).toEqual([]);
});
