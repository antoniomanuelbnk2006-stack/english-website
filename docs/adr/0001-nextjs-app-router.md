# ADR-0001 · Next.js 16 con App Router como framework

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto
Señal necesita páginas con mucho contenido estático (lecciones), datos de usuario dinámicos, un reproductor de audio interactivo, un *endpoint* de servidor para la IA y comportamiento PWA. Tú ya conoces React y Next.js, y el proyecto es de una sola persona a tiempo parcial.

## Decisión
**Next.js 16.x con App Router**, TypeScript estricto y Turbopack (por defecto en esta versión). Server Components por defecto, Server Actions para mutaciones, un Route Handler para la IA y `proxy.ts` para la sesión.

## Alternativas consideradas
- **React + Vite (SPA) + Supabase directo:** más simple, pero sin servidor propio para la IA (habría que añadir funciones aparte) y sin RSC para cargar contenido sin JavaScript en cliente.
- **Remix / React Router v7 (framework):** buena opción técnica, pero menos experiencia previa y menos integración con Vercel.
- **Astro + islas:** excelente para contenido, más incómodo para una app muy interactiva con estado de usuario.

## Consecuencias
- ✅ Un único proyecto full-stack; despliegue trivial en Vercel; documentación de la versión instalada disponible para Claude Code vía `AGENTS.md`.
- ✅ Contenido renderizado en servidor; el cliente solo carga lo interactivo.
- ⚠️ Cambios de Next 16 a tener en cuenta: `proxy.ts` en lugar de `middleware.ts`, APIs de petición asíncronas, `next lint` eliminado, Turbopack por defecto (afecta a librerías PWA).
- ⚠️ Dependencia de las versiones de seguridad de Next.js: hay que actualizar con rapidez.
