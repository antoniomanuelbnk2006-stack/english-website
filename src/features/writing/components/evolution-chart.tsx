import type { ScorePoint } from '@/features/writing/lib/history';
import { MAX_SCORE } from '@/features/writing/lib/schema';

const WIDTH = 240;
const HEIGHT = 56;
const PAD = 6;
/** La nota que significa «adecuado para el nivel»: se marca como referencia. */
const ADEQUATE = 3;

const y = (score: number) => HEIGHT - PAD - (score / MAX_SCORE) * (HEIGHT - 2 * PAD);

/**
 * Evolución de un criterio: una línea con un punto por writing. Los puntos rellenos son notas
 * de la IA; los huecos, autoevaluaciones. `label` describe la serie para quien no la ve.
 */
export function EvolutionChart({
  points,
  label,
}: {
  points: readonly ScorePoint[];
  label: string;
}) {
  const x = (index: number) =>
    points.length === 1 ? WIDTH / 2 : PAD + (index * (WIDTH - 2 * PAD)) / (points.length - 1);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-14 w-full max-w-xs text-accent"
    >
      <line
        x1={PAD}
        x2={WIDTH - PAD}
        y1={y(ADEQUATE)}
        y2={y(ADEQUATE)}
        strokeDasharray="3 4"
        className="stroke-border"
      />
      {points.length > 1 ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          points={points.map((point, index) => `${x(index)},${y(point.score)}`).join(' ')}
        />
      ) : null}
      {points.map((point, index) => (
        <circle
          key={point.id}
          cx={x(index)}
          cy={y(point.score)}
          r="3"
          stroke="currentColor"
          strokeWidth="1.5"
          className={point.kind === 'ai' ? 'fill-accent' : 'fill-surface'}
        />
      ))}
    </svg>
  );
}
