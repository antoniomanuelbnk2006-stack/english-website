# ADR-0007 · IA pregenerada + corrección de writing en vivo con límites

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
La IA permite contenido casi ilimitado y feedback de writing, pero en tiempo real cuesta dinero, añade latencia y puede fallar. Tu preferencia: coste casi cero y control de calidad.

## Decisión
1. **Contenido pregenerado** en el pipeline local con la Claude API: **Sonnet 5.5** genera (Batch API, −50 %), **Opus 5.5** revisa como modelo independiente, **Haiku 5.5** hace tareas baratas. Salidas estructuradas validadas con Zod. Nada de esto ocurre en tiempo real.
2. **Única llamada en vivo:** feedback de writing con Sonnet 5.5 (`effort: medium`), con **límite diario** (10) y **tope mensual** (5 $) en la app, más un límite de gasto en la consola.
3. La IA **nunca** está en el camino crítico de la app.

## Alternativas consideradas
- **Tutor IA en tiempo real (voz, ejercicios al momento):** más potente, pero coste y complejidad mucho mayores; queda como posible fase futura.
- **Sin IA:** contenido limitado a lo que puedas escribir a mano o al dominio público; insuficiente para cubrir A1–C2.

## Consecuencias
- ✅ Coste total estimado de ~25–35 $ para todo el currículo y < 1 $/mes en writing con uso normal.
- ✅ El contenido se revisa antes de llegar a ti; la app funciona aunque la API falle.
- ⚠️ La calidad depende de los prompts y del QA: hay conjunto dorado (`pnpm ai:eval`) y umbrales de revisión.
- ⚠️ Los modelos se retiran con el tiempo (los 5.5, no antes de septiembre–octubre de 2027): IDs en variables de entorno.
