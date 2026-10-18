'use client';

import { Volume2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useContentLanguage } from '@/components/content-language';
import { canSpeak, speakText } from '@/features/pronunciation/lib/speech';
import type { Accent } from '@/features/pronunciation/lib/voices';
import { cn } from '@/lib/utils';

const noop = () => () => {};

/** ¿Tiene este navegador síntesis de voz? En el servidor (y al hidratar) se da por hecho que no. */
export function useCanSpeak(): boolean {
  return useSyncExternalStore(noop, canSpeak, () => false);
}

/**
 * Botón que dice un texto con la voz del navegador: en inglés, o en el idioma de la pantalla.
 *  No se pinta si el navegador no
 * tiene síntesis de voz.
 */
export function SpeakButton({
  text,
  label,
  accent,
  rate,
  children,
  className,
  variant = 'ghost',
  size = 'icon',
}: {
  text: string;
  /** Nombre accesible: «Escuchar "abandon"». */
  label: string;
  accent?: Accent;
  rate?: number;
} & Pick<ButtonProps, 'children' | 'className' | 'variant' | 'size'>) {
  const available = useCanSpeak();
  // En una pantalla de otro idioma, la voz es la de ese idioma.
  const language = useContentLanguage();
  const [speaking, setSpeaking] = useState(false);
  if (!available) return null;

  return (
    <Button
      variant={variant}
      size={size}
      aria-label={children ? undefined : label}
      title={children ? undefined : label}
      className={cn(speaking && 'text-accent-text', className)}
      onClick={() => {
        setSpeaking(true);
        speakText(text, { accent, language, rate, onEnd: () => setSpeaking(false) });
      }}
    >
      <Volume2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
      {children}
    </Button>
  );
}
