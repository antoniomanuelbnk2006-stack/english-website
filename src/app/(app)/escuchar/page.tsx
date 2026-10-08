import type { Metadata } from 'next';
import { PendingPage } from '@/components/shell/pending-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.listen') };
}

export default function Page() {
  return <PendingPage title="nav.listen" body="pending.listen" phase={2} />;
}
