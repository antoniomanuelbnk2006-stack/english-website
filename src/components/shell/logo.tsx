import { cn } from '@/lib/utils';

/** Marca: cuatro barras de señal crecientes y el nombre. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-2.5', className)}>
      <span aria-hidden="true" className="inline-flex h-6 items-end gap-[3px]">
        <span className="h-[35%] w-[5px] rounded-[2px] bg-accent/45" />
        <span className="h-[55%] w-[5px] rounded-[2px] bg-accent/65" />
        <span className="h-[78%] w-[5px] rounded-[2px] bg-accent/85" />
        <span className="h-full w-[5px] rounded-[2px] bg-accent" />
      </span>
      <span className="text-xl leading-none font-semibold tracking-tight">Señal</span>
    </span>
  );
}
