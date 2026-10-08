import type { Metadata } from 'next';
import { PendingPage } from '@/components/shell/pending-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.level') };
}

export default function Page() {
  return <PendingPage title="nav.level" body="pending.level" phase={5} />;
}
