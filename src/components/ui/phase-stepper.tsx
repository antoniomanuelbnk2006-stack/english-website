import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Fases de un ciclo (escucha o lectura), como lista ordenada con la fase actual marcada.
 * En pantallas estrechas solo la fase actual muestra su nombre; el resto, su número.
 */
export function PhaseStepper({
  phases,
  current,
  label,
}: {
  phases: readonly string[];
  /** Índice de la fase actual. */
  current: number;
  /** Texto accesible, p. ej. «Fase 2 de 5». */
  label: string;
}) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {phases.map((name, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={name}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap',
              // Sin opacidad en las fases futuras: el texto atenuado dejaría de cumplir 4,5:1.
              active ? 'border-accent font-medium text-accent' : 'border-border text-muted',
              !active && !done && 'border-dashed',
            )}
          >
            {done ? (
              <Check aria-hidden="true" className="size-3.5 text-success" strokeWidth={2.25} />
            ) : (
              <span aria-hidden="true" className="hud">
                {index + 1}
              </span>
            )}
            <span className={cn(!active && 'sr-only sm:not-sr-only')}>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}
