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
      className={cn('h-9 w-auto dark:brightness-0 dark:invert', className)}
    />
  );
}
