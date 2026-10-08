# ADR-0009 · Nivel por destreza con rating tipo Elo + pruebas de confirmación

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
Para elegir contenido i + 1 y medir progreso hace falta una estimación continua del nivel **por destreza** (listening ≠ reading). Con un único usuario no hay datos para calibrar ítems con teoría de respuesta al ítem completa.

## Decisión
- **Rating tipo Elo por destreza** en la misma escala que la dificultad de ítems y lecciones (A1 600–799 … C2 ≥ 1600). Actualización por ítem con K decreciente (32 → 16 → 10), peso por tipo de tarea para compensar el azar y tope de ±60 por lección.
- Dificultad de lecciones **calculada** a partir de nivel, cobertura léxica, velocidad y sintaxis, ajustable a mano.
- **Pruebas de confirmación** con contenido nuevo para declarar un cambio de nivel; el rating sugiere, la prueba confirma.

## Alternativas consideradas
- **IRT (Rasch/2PL) completa:** más rigurosa, pero necesita muchas respuestas de muchas personas para calibrar.
- **Nivel fijo por unidades completadas:** mide asistencia, no competencia.
- **Solo pruebas periódicas:** sin información diaria para elegir contenido.

## Consecuencias
- ✅ Simple, transparente, testeable con simulaciones; sirve a la vez para medir y para elegir contenido.
- ✅ El nivel «oficial» no se infla por rachas o por contenido demasiado fácil.
- ⚠️ La dificultad de los ítems es una estimación: se vigila con la dificultad observada y se contrasta con pruebas externas cada pocos meses.
