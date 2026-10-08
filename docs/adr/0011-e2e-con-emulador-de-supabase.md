# ADR-0011 · Tests e2e y de base de datos contra un emulador de Supabase en memoria

- **Estado:** Aceptada
- **Fecha:** 2026-10-08

## Contexto

El plan de [testing](../06-desarrollo/03-testing-y-calidad.md) preveía ejecutar los e2e contra Supabase local (`supabase start`), que necesita Docker, y automatizar el login leyendo el código OTP del visor de correo de pruebas.

Al construir las fases 0–3 no había Docker en la máquina de desarrollo ni un proyecto de Supabase creado todavía. Sin una base de datos real no se podían probar ni las políticas RLS, ni las funciones SQL (`apply_lesson_attempts`, `apply_reviews`), ni ningún flujo con sesión.

## Decisión

Los tests usan **PGlite** (Postgres real compilado a WebAssembly) con **las migraciones del proyecto aplicadas tal cual**:

- `tests/support/test-db.ts` crea la base de datos en memoria, con el mínimo de Supabase que las migraciones dan por hecho (roles `anon`/`authenticated`, esquema `auth`, `auth.uid()`). Los tests de `tests/db/` prueban ahí RLS, *triggers* y funciones.
- `tests/support/supabase-emulator.ts` levanta sobre esa base un servidor HTTP que habla el subconjunto de GoTrue (OTP, verificación, renovación) y de PostgREST (select, insert, upsert, update, delete, filtros y RPC) que usa la app. Playwright arranca el emulador y la app compilada (`pnpm build && pnpm start`) apuntando a él.
- El contenido de los e2e es una copia de `content/` en `.e2e/content` en la que la lección de escucha pasa por el **pipeline real de audio** con un TTS de prueba (tonos con tiempos por palabra), para ejercitar el reproductor, el karaoke y las tarjetas de audio sin claves de Azure.

## Alternativas consideradas

- **Supabase local con Docker** (lo previsto). Más fiel, pero exige Docker en cada máquina y en CI tarda bastante más en arrancar. Sigue siendo posible: nada del código de la app depende del emulador.
- **Simular el cliente de Supabase con dobles.** Rápido, pero no prueba SQL, RLS ni funciones, que es justo donde están los fallos caros.
- **Un proyecto de Supabase de pruebas en la nube.** Tests lentos, dependientes de la red y con datos compartidos entre ejecuciones.

## Consecuencias

- Los tests corren en cualquier máquina con Node, sin Docker, en unos minutos, y prueban el SQL real.
- El emulador **no es Supabase**: solo implementa lo que la app usa hoy. Cada operación nueva de PostgREST (un filtro, un modificador) hay que añadirla al emulador; si falta, el test falla con «operador no emulado», no en silencio.
- No se prueban el envío real de correos, los límites de GoTrue ni las diferencias finas de PostgREST. Por eso, **antes de cada despliegue con cambios de esquema o de consultas hay que probar a mano contra el proyecto real** (y, cuando haya Docker, se puede añadir un job opcional con `supabase start`).
- Los tipos de `database.types.ts` no los genera el emulador: siguen saliendo de `pnpm db:types` contra el proyecto enlazado.
- El mismo emulador sirve para la **demostración local** (`pnpm demo`). Ahí guarda la base de datos en `.demo-data/` (variable `EMULATOR_DATA_DIR`), anota qué migraciones ha aplicado para no repetirlas y desactiva las rutas de control `/__test/…`. En los tests sigue siendo en memoria.
- El emulador se comporta como GoTrue con una sesión cuyo usuario ya no existe: la rechaza (`user_not_found`) y la app vuelve a la pantalla de acceso. Los tokens de renovación van firmados y sin estado, para que la sesión sobreviva a un reinicio.
