# ADR-0025 · Políticas RLS por operación, y solo las que cada tabla necesita

- **Estado:** Aceptada
- **Fecha:** 2026-10-13

## Contexto

Desde la migración base, cada tabla tenía una sola política `for all`: el usuario podía leer, crear, cambiar y borrar sus propias filas en todas. Protege de lo importante (nadie ve ni toca lo de otro), pero le da a la sesión más de lo que la app usa. Quien consiguiera esa sesión podría, llamando directamente a la API de Supabase, borrar el historial de intentos, reescribir repasos ya hechos o vaciar el léxico: cosas que la app no hace nunca.

El [ADR-0024](0024-bloqueo-de-acceso-y-registro-de-la-ia.md) ya dejó en solo lectura las dos tablas donde eso costaba dinero o seguridad. Este ADR aplica el mismo criterio al resto.

## Decisión

**Una política por operación (`select`, `insert`, `update`, `delete`) y solo para las operaciones que la app hace sobre esa tabla**, directamente o a través de sus funciones SQL `security invoker`. Lo que no tiene política queda denegado (migración 0007).

| Tablas | select | insert | update | delete |
|---|:-:|:-:|:-:|:-:|
| `profiles`, `skill_ratings`, `lesson_progress`, `lexicon`, `srs_cards`, `writing_submissions`, `activity_days` | ✓ | ✓ | ✓ | · |
| `input_log` (el diario: lo único que la app borra) | ✓ | ✓ | ✓ | ✓ |
| `item_attempts`, `srs_reviews`, `rating_history`, `listening_diagnostics` (historiales: solo se añade) | ✓ | ✓ | · | · |
| `daily_plans`, `placement_results`, `achievements` (sin uso todavía) | ✓ | · | · | · |
| `ai_usage`, `login_attempts` ([ADR-0024](0024-bloqueo-de-acceso-y-registro-de-la-ia.md)) | ✓ | · | · | · |

- Las condiciones no cambian: `(select auth.uid()) = user_id` (`id` en `profiles`), en `using` y en `with check`.
- Las tres tablas sin uso se quedan en solo lectura. La política de escritura se añadirá, en su propia migración, con la función que las empiece a usar.
- `tests/db/policies.test.ts` compara las políticas reales con esa tabla y falla si aparece una tabla nueva sin declarar o una política `for all`.

## Alternativas consideradas

- **Dejar `for all`.** Con un solo usuario, lo que se gana es limitar el daño de una sesión robada, no proteger a unos usuarios de otros. Aun así es barato y no cuesta nada en uso normal.
- **Quitar también los permisos de tabla (`revoke`)** además de las políticas. Con RLS activo basta la ausencia de política; dos mecanismos para lo mismo son dos sitios donde equivocarse al añadir una operación.
- **Dar ya `insert` a las tablas sin uso.** Es adivinar lo que necesitará una función que no existe.
- **Historiales inmutables con un *trigger*.** Las políticas ya impiden cambiarlos con la sesión; un *trigger* también frenaría a las funciones `security definer` y a las migraciones, que no es el objetivo.

## Consecuencias

- **Una operación nueva sobre una tabla necesita su política**, en la misma migración que el código que la usa. Sin ella no falla con un error: un `update` o un `delete` sin política simplemente no toca ninguna fila. Un `insert` sí se rechaza.
- Borrar la cuenta desde la app (Ajustes → borrar, aún sin hacer) no podrá ser un `delete` del usuario sobre sus tablas: tendrá que ser una función propia.
- Un `upsert` necesita las tres: `select`, `insert` y `update`.
- La regla de las migraciones pasa a ser: tabla nueva, con `user_id`, RLS y **una política por cada operación que haga falta** en la misma migración.
