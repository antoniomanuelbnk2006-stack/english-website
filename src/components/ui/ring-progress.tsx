import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Anillo de progreso (minutos del día). El valor va también en texto: `label` y `children`. */
export function RingProgress({
  value,
  max,
  label,
  size = 96,
  children,
  className,
}: {
  value: number;
  max: number;
  label: string;
  size?: number;
  children?: ReactNode;
  className?: string;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn(
            'transition-[stroke-dashoffset] duration-300 ease-out',
            ratio >= 1 ? 'stroke-success' : 'stroke-accent',
          )}
        />
      </svg>
      {children ? (
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
