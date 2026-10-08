# ADR-0010 · Un solo usuario, con arquitectura multiusuario «dormida»

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
La app es para ti. No hay negocio, pagos ni registro público. Pero rehacer la base de datos si algún día quisieras abrirla sería caro.

## Decisión
- **Producto de un usuario:** registro desactivado en Supabase, `signInWithOtp` con `shouldCreateUser: false` y **lista de emails permitidos** comprobada en `proxy.ts` y en cada acción.
- **Arquitectura multiusuario por debajo:** todas las tablas con `user_id` y RLS; ninguna consulta asume «el único usuario»; nada de la clave *secret* en la app.
- Sin funcionalidades de equipo, roles, pagos ni panel de administración.

## Alternativas consideradas
- **Sin autenticación (app privada por URL secreta):** demasiado frágil, sobre todo con la IA de pago detrás.
- **SaaS desde el día 1:** pagos, legal, soporte y métricas de negocio que no aportan a tu objetivo de aprender.

## Consecuencias
- ✅ Seguridad razonable sin complejidad; coste cero.
- ✅ Abrir la app en el futuro exigiría añadir registro, límites por usuario y pagos, pero **no** migrar datos ni rehacer políticas.
- ⚠️ El contenido y los límites de IA están pensados para una persona; habría que revisarlos si cambia el público.
