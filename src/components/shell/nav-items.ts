import {
  BookA,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  GraduationCap,
  Headphones,
  Languages,
  Layers,
  Mic,
  NotebookPen,
  PencilRuler,
  PenLine,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import type { TranslationKey } from '@/lib/i18n';

export interface NavItem {
  href: Route;
  label: TranslationKey;
  icon: LucideIcon;
}

/** Barra inferior en móvil: Hoy · Escuchar · Leer · Repasar (+ Más). */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/hoy', label: 'nav.today', icon: CalendarDays },
  { href: '/escuchar', label: 'nav.listen', icon: Headphones },
  { href: '/leer', label: 'nav.read', icon: BookOpen },
  { href: '/repasar', label: 'nav.review', icon: Layers },
];

/** Lo que en móvil queda bajo «Más» y en escritorio completa la barra lateral. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/vocabulario', label: 'nav.vocabulary', icon: BookA },
  { href: '/palabras', label: 'nav.words', icon: Languages },
  { href: '/gramatica', label: 'nav.grammar', icon: PencilRuler },
  { href: '/use-of-english', label: 'nav.useOfEnglish', icon: GraduationCap },
  { href: '/escribir', label: 'nav.write', icon: PenLine },
  { href: '/pronunciar', label: 'nav.pronunciation', icon: Mic },
  { href: '/progreso', label: 'nav.progress', icon: ChartNoAxesColumn },
  { href: '/diario', label: 'nav.journal', icon: NotebookPen },
  { href: '/ajustes', label: 'nav.settings', icon: Settings },
];

/** Una entrada está activa en su ruta y en las que cuelgan de ella (/leer → /leer/b1-rea-001). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
