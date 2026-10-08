# ADR-0002 · Supabase para base de datos y autenticación

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
Hay que guardar progreso, léxico, repasos, diario y writings de un usuario, con autenticación segura y coste cero. Ya has usado Supabase y PostgreSQL.

## Decisión
**Supabase** (plan Free): Postgres con **RLS en todas las tablas**, Auth con **email + código OTP**, migraciones SQL versionadas con la CLI y tipos TypeScript generados. Integración con `@supabase/ssr` y las claves nuevas **publishable/secret**.

## Alternativas consideradas
- **Neon + Auth.js/Better Auth:** Postgres excelente, pero hay que montar la autenticación y las políticas a mano.
- **Firebase:** sin SQL; consultas de agregados (progreso, estadísticas) más incómodas.
- **SQLite local + sincronización:** atractivo para *offline*, pero complejidad de sincronización desproporcionada para v1.

## Consecuencias
- ✅ Auth + BD + RLS en un solo servicio gratuito; entorno local idéntico con Docker.
- ✅ El esquema multiusuario sale gratis (ver [ADR-0010](0010-un-solo-usuario.md)).
- ⚠️ El plan Free **pausa el proyecto tras 7 días sin actividad** (datos intactos; reactivación manual).
- ⚠️ 500 MB de BD: suficiente (se estiman decenas de MB por año), pero el audio **no** va aquí ([ADR-0004](0004-audio-en-r2.md)).
- ⚠️ Sin restauración a un punto en el tiempo en Free: exportaciones y volcados propios.
