import type { Metadata } from 'next';
import { PendingPage } from '@/components/shell/pending-page';
import { getSessionOrRedirect } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.progress') };
}

export default async function Page() {
  await getSessionOrRedirect();
  return <PendingPage title="nav.progress" body="pending.progress" phase={5} />;
}
