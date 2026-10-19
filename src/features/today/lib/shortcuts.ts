import {
  BookOpen,
  GraduationCap,
  Headphones,
  Layers,
  NotebookPen,
  PencilRuler,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Los accesos de «Plan de hoy». Los usan la página (src/app/(app)/hoy) y la copia que enseña la
 * portada dentro del portátil (preview.ts), que pinta los mismos iconos por su `href`.
 */
export const TODAY_SHORTCUTS: {
  href: Route;
  icon: LucideIcon;
  title: TranslationKey;
  hint?: TranslationKey;
}[] = [
  { href: '/escuchar', icon: Headphones, title: 'today.listenCta', hint: 'today.listenHint' },
  { href: '/leer', icon: BookOpen, title: 'today.readCta', hint: 'today.readHint' },
  // El texto del repaso depende de cuántas tarjetas toquen ahora.
  { href: '/repasar', icon: Layers, title: 'today.reviewCta' },
  {
    href: '/use-of-english',
    icon: GraduationCap,
    title: 'today.uoeCta',
    hint: 'today.uoeHint',
  },
  { href: '/gramatica', icon: PencilRuler, title: 'today.grammarCta', hint: 'today.grammarHint' },
  { href: '/diario', icon: NotebookPen, title: 'today.journalCta', hint: 'today.journalHint' },
];
