import { PageContainer } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/panel';

/** Esqueleto con la forma de una pantalla tipo panel; nunca un spinner a pantalla completa. */
export default function AppLoading() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-6 w-56" />
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-56" />
      <Skeleton className="h-40" />
    </PageContainer>
  );
}
