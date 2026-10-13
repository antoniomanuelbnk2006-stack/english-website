import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Los nombres de MASTER (src/styles/globals.css) no son los de Tailwind: sin decírselo, la fusión
// de clases tomaría `text-body-sm` y `text-muted` por lo mismo y se quedaría con una sola.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'caption',
        'body-sm',
        'body',
        'body-lg',
        'subheading',
        'heading-sm',
        'heading',
        'heading-lg',
        'display',
      ],
      color: [
        'canvas',
        'surface',
        'surface-2',
        'border',
        'border-soft',
        'text',
        'muted',
        'accent',
        'accent-hover',
        'accent-text',
        'on-accent',
        'success',
        'error',
        'warning',
      ],
      radius: ['card', 'pill', 'nav', 'structure'],
      container: ['page', 'exercise'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
