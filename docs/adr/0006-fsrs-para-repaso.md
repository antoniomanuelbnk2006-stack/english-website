# ADR-0006 · FSRS (ts-fsrs) para la repetición espaciada

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
El repaso debe ser eficiente (máximo recuerdo con mínimo tiempo) porque compite con el input. Se repasan palabras, expresiones, **frases de audio** y gramática.

## Decisión
**FSRS** (versión actual, FSRS-6) mediante **`ts-fsrs`**, con retención deseada 0,90, *fuzz*, pasos de aprendizaje de 1 y 10 minutos, 10 tarjetas nuevas/día y 15 minutos máximo. El estado de cada tarjeta se guarda en columnas que reflejan el `Card` de ts-fsrs; el historial (`srs_reviews`) permite **optimizar los parámetros** con tus datos más adelante. El servidor recalcula el estado (no confía en el cliente).

## Alternativas consideradas
- **SM-2 (Anki clásico):** simple, pero menos eficiente y sin modelo de memoria explícito.
- **Leitner por cajas:** demasiado tosco.
- **Algoritmo propio:** reinventar algo peor.

## Consecuencias
- ✅ Menos repasos para la misma retención; parámetros optimizables con `@open-spaced-repetition/binding`.
- ✅ Librería TypeScript mantenida, usable en cliente y servidor.
- ⚠️ Las columnas deben seguir los cambios de tipos entre versiones de ts-fsrs (fijar la versión y revisar al actualizar).
