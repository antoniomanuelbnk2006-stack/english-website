import type { Metadata } from 'next';
import { PendingPage } from '@/components/shell/pending-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.journal') };
}

export default function Page() {
  return <PendingPage title="nav.journal" body="pending.journal" phase={1} />;
}
