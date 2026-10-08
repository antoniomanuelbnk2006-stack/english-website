# ADR-0013 · Modo «con transcripción» en las lecciones de escucha

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

El ciclo de escucha se diseñó para que la transcripción no llegase al navegador antes de la fase 3: primero dos escuchas a ciegas, luego el dictado, y solo entonces el texto. Era una de las reglas «NUNCA» de `CLAUDE.md` (n.º 4) y está en la [pedagogía de listening](../01-pedagogia/03-listening.md).

Al usar la app, el dueño pidió poder escuchar **también con la transcripción delante**. Consultado sobre la contradicción con su propia regla, eligió que cada lección ofrezca los dos modos al empezar.

## Decisión

Cada lección de escucha se puede hacer de dos maneras, que se eligen en la pantalla de preparación:

- **A ciegas** (por defecto, y el recomendado): el ciclo de ocho fases, sin cambios.
- **Con transcripción**: reproductor y texto con karaoke y glosario desde el principio. Sin preguntas, sin dictado y sin nota. Al terminar, el tiempo se anota en el diario de input y se ofrece la cosecha de palabras.

La regla de seguridad se mantiene con una excepción explícita. La transcripción solo sale del servidor si:

1. el progreso guardado ha superado las dos escuchas a ciegas (`phase >= 3`), **o**
2. el usuario ha elegido el modo con transcripción, lo que queda anotado en `lesson_progress.transcript_first` (migración `0003`).

Es una única función pura, `transcriptUnlocked` (`features/listening/lib/views.ts`), que usan `getTranscript`, `openWithTranscript` y `addCards`. `transcript_first` solo se marca si el texto se abre **antes** de completar las escuchas a ciegas: releer con texto una lección ya hecha no la invalida.

## Alternativas consideradas

- **Mantener la regla y ofrecer el texto solo tras las dos escuchas.** Fiel al diseño, pero no es lo que el dueño pidió: quiere poder leer mientras escucha por primera vez.
- **Un botón «ver transcripción» siempre visible dentro del ciclo.** Mezcla los dos modos: sería fácil pulsarlo a mitad de una escucha a ciegas y estropear el diagnóstico sin haberlo decidido. Elegir al empezar obliga a decidirlo antes.
- **No registrar nada.** Más simple, pero entonces no habría forma de distinguir después un ciclo a ciegas real de uno hecho tras leer el guion.

## Consecuencias

- Una lección abierta con transcripción **ya no mide el oído**: si luego se hace el ciclo a ciegas, la app lo avisa, y el cálculo de nivel por destreza (fase 5) debe excluir las lecciones con `transcript_first = true`.
- Leer mientras se escucha es más cómodo y sirve para afianzar vocabulario y ritmo, pero entrena menos la decodificación, que es el punto débil que la app quiere atacar. Por eso «a ciegas» sigue siendo la opción destacada y el texto de la pantalla lo dice.
- La regla n.º 4 de `CLAUDE.md` y las referencias de `docs/` se han reescrito para recoger la excepción.
- Con más contenido por nivel, el uso sensato es: a ciegas las lecciones nuevas de tu nivel; con transcripción las que te quedan grandes o las que ya has hecho.
