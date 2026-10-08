'use client';

import { useEffect } from 'react';
import { markFichaSeen } from '@/features/grammar/server/actions';

/** Anota que la ficha se ha abierto. No pinta nada. */
export function MarkSeen({ grammarId }: { grammarId: string }) {
  useEffect(() => {
    // Si falla no pasa nada: se volverá a intentar la próxima vez que se abra la ficha.
    void markFichaSeen({ grammarId }).catch(() => undefined);
  }, [grammarId]);
  return null;
}
