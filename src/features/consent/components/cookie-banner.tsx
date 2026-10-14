'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveConsent } from '@/features/consent/lib/browser';
import { applyConsentToSession } from '@/features/consent/server/actions';
import { COOKIE_POLICY_URL, type Consent } from '@/lib/consent';
import { useT } from '@/lib/i18n/client';

/**
 * Aviso de cookies (ADR-0028). Se pinta mientras no haya decisión; no tapa la página ni impide
 * usarla. «Rechazar» y «Aceptar» pesan lo mismo: ninguna de las dos es la acción cobalto.
 */
export function CookieBanner() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  function decide(choice: Consent) {
    saveConsent(choice);
    setOpen(false);
    // Si hay sesión, pasa a recordarse o no según la decisión (ADR-0030). Después el servidor
    // vuelve a pintar con la decisión ya tomada (y sin las cookies que se hayan borrado).
    void applyConsentToSession().finally(() => router.refresh());
  }

  return (
    <>
      {/* El sitio que ocupa el aviso, al final de la página: así nunca deja nada debajo. */}
      <div aria-hidden="true" className="cookie-banner-space" />
      <section aria-label={t('consent.title')} className="cookie-banner">
        <p>
          {t('consent.body')}{' '}
          <a href={COOKIE_POLICY_URL} className="text-accent-text underline underline-offset-4">
            {t('consent.more')}
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => decide('necessary')}>
            {t('consent.reject')}
          </Button>
          <Button variant="ghost" onClick={() => decide('all')}>
            {t('consent.accept')}
          </Button>
        </div>
      </section>
    </>
  );
}
