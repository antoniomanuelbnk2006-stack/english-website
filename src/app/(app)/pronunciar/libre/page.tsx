import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/page';
import { FreePractice } from '@/features/pronunciation/components/free-practice';
import { cleanFreeText } from '@/features/pronunciation/lib/free-text';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('pronunciation.freeTitle') };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function FreePronunciationPage({
  searchParams,
}: PageProps<'/pronunciar/libre'>) {
  const [params, t] = await Promise.all([searchParams, getT()]);
  // `?texto=` llega desde el mazo de palabras; el texto solo se pinta, nunca se ejecuta.
  const initial = cleanFreeText(first(params.texto) ?? '');

  return (
    <PageContainer className="max-w-2xl">
      <header className="flex flex-col gap-3">
        <Link
          href="/pronunciar"
          className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('pronunciation.backToList')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('pronunciation.freeTitle')}
        </h1>
        <p className="text-sm text-muted">{t('pronunciation.freeSubtitle')}</p>
      </header>

      <FreePractice key={initial} initial={initial} />
    </PageContainer>
  );
}
