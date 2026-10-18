'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { BASE_LANGUAGE, type PracticeLanguage } from '@/lib/content/language';
import { htmlLang } from '@/lib/i18n';

// El idioma del contenido que se está viendo (ADR-0036). Los textos que se aprenden llevan su
// `lang` (para las fuentes y para la voz del lector de pantalla), y ese idioma ya no es siempre
// el inglés. Una pantalla de contenido lo pone una vez; los componentes de dentro lo leen.

const ContentLanguageContext = createContext<PracticeLanguage>(BASE_LANGUAGE);

export function ContentLanguage({
  language,
  children,
}: {
  language: PracticeLanguage;
  children: ReactNode;
}) {
  return (
    <ContentLanguageContext.Provider value={language}>{children}</ContentLanguageContext.Provider>
  );
}

/** El idioma del contenido de esta pantalla (inglés si no se ha dicho otro). */
export function useContentLanguage(): PracticeLanguage {
  return useContext(ContentLanguageContext);
}

/** La etiqueta `lang` del contenido de esta pantalla. */
export function useContentLang(): string {
  return htmlLang(useContentLanguage());
}
