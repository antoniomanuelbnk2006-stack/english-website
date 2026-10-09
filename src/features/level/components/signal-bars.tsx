import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import { cn } from '@/lib/utils';

const HEIGHTS = ['h-[30%]', 'h-[44%]', 'h-[58%]', 'h-[72%]', 'h-[86%]', 'h-full'] as const;

const SIZES = {
  sm: 'h-4 gap-[3px] [&>span]:w-[4px]',
  md: 'h-6 gap-1 [&>span]:w-1.5',
  lg: 'h-10 gap-1.5 [&>span]:w-2.5',
} as const;

export interface SignalBarsProps {
  /** Nivel que se pinta: el estimado por el rating o, en la cabecera, el elegido. */
  level: CefrLevel;
  /** Progreso hacia el nivel siguiente, de 0 a 1. */
  progress: number;
  /** Último nivel confirmado con una prueba; `null` si aún no hay ninguno. */
  confirmed?: CefrLevel | null;
  /** Texto accesible completo, p. ej. «Listening: B1, 63 % hacia B2». */
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Nivel como barras de cobertura, una por nivel A1–C2 (docs/03-producto/04-gamificacion.md §4).
 * Sólido = confirmado; atenuado = estimado sin confirmar; la barra siguiente se rellena con el progreso.
 */
export function SignalBars({
  level,
  progress,
  confirmed = null,
  label,
  size = 'md',
  className,
}: SignalBarsProps) {
  const current = CEFR_LEVELS.indexOf(level);
  const confirmedIndex = confirmed ? CEFR_LEVELS.indexOf(confirmed) : -1;
  const fill = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-end', SIZES[size], className)}
    >
      {CEFR_LEVELS.map((name, index) => {
        const reached = index <= current;
        const filling = index === current + 1;
        return (
          <span
            key={name}
            aria-hidden="true"
            className={cn(
              'relative overflow-hidden rounded-[2px] bg-border',
              HEIGHTS[index],
              reached && (index <= confirmedIndex ? 'bg-accent' : 'bg-accent/55'),
            )}
          >
            {filling ? (
              <span
                className="absolute inset-x-0 bottom-0 bg-accent/55"
                style={{ height: `${fill}%` }}
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
