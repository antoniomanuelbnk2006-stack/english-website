import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Marca: el logotipo de la presentación (onda y nombre). */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/landing/logo.png"
      alt="Señal"
      width={114}
      height={35}
      priority
      // MASTER es monocromo: el logotipo va en un solo tono, claro u oscuro según el tema.
      className={cn('h-8 w-auto [filter:var(--logo-filter)]', className)}
    />
  );
}
