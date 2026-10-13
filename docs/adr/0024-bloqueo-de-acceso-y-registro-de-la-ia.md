# ADR-0024 · Bloqueo por intentos de acceso y registro del uso de la IA que la sesión no puede tocar

- **Estado:** Aceptada
- **Fecha:** 2026-10-13

## Contexto

La revisión de seguridad del 13 de octubre de 2026 encontró dos cosas que dependían de quien menos conviene:

1. **El acceso con código no tenía freno propio.** Probar códigos contra `verifyOtp` solo lo limitaba Supabase, y por IP. Pero la IP que ve Supabase es la del servidor de la app (Vercel), no la de quien prueba. El email no es un secreto ([ADR-0020](0020-codigo-fijo-de-acceso.md)), así que la única barrera era el código.
2. **Los límites de la IA se calculaban con filas que el usuario puede borrar.** El límite diario y el tope mensual salían de contar `writing_submissions`, cuya política RLS es `for all`: con la sesión del usuario y la API de Supabase se podían borrar o abaratar esas filas y seguir gastando. Además, comprobar el límite y registrar el envío eran dos pasos, y varias peticiones a la vez pasaban todas.

En los dos casos hace falta guardar algo que **ni el propio usuario pueda cambiar**, porque quien lo intentaría es alguien que ha conseguido su sesión (o que todavía no la tiene). Y la app no usa la clave *secret* de Supabase: todo va como el usuario, con RLS.

## Decisión

**Dos tablas que el usuario solo puede leer, escritas por funciones `security definer` pensadas para que llamarlas a mano no sirva de nada.** Sin clave *secret* en la app y sin secretos nuevos.

### 1. `login_attempts`: bloqueo por intentos (migración 0005)

- `verifyOtp` llama a `login_attempt_begin(email)` **antes** de probar el código. La función suma un intento y dice si se puede seguir. Si no se puede anotar el intento, no se prueba nada.
- Se admiten cinco intentos seguidos. Desde el quinto, cada intento deja cerrado el acceso con código 1, 2, 4, 8… minutos, hasta 24 horas. Un intento rechazado no cuenta ni alarga la espera.
- Entrar pone la cuenta a cero (`login_attempt_clear`, que solo se puede llamar con sesión). Vale entrar con el código o con el enlace del correo.
- **El enlace del correo no pasa por el bloqueo.** Es la vía de recuperación: su código de un solo uso es largo, al azar y solo vale en el navegador que pidió el correo. `pnpm auth:set-code <código>` también pone la cuenta a cero, desde el ordenador del dueño.
- El bloqueo cuenta todos los códigos que pasan por `verifyOtp`: el fijo y el de seis cifras del correo.

### 2. `ai_usage`: registro del uso de la IA (migración 0006)

- `ai_usage_reserve(...)` comprueba el límite diario y el tope mensual y, si caben, inserta una fila `pending` con **lo máximo que puede costar la llamada**. Todo dentro de un cerrojo por usuario (`pg_advisory_xact_lock`): no hay carrera entre comprobar e insertar.
- Devuelve un **resguardo** (un UUID al azar del que la tabla solo guarda el `sha256`). `ai_usage_settle(...)` cierra la reserva con el coste real, y solo con ese resguardo, que no sale del servidor de la app.
- Una reserva sin cerrar cuenta por su importe máximo: si el servidor se cae a mitad, el registro peca de prudente.
- Las reglas son las de antes (`features/writing/lib/limits.ts`): al límite diario no le cuentan los rechazos ni las respuestas cortadas; al tope mensual, todo lo cobrado.
- `writing_submissions` sigue guardando el texto, la corrección y el coste de cada entrega para el historial, pero **ya no decide nada**. La vista `v_ai_spend_month` lee de `ai_usage`.
- La migración copia a `ai_usage` los envíos a la IA hechos hasta entonces: lo gastado en el mes sigue contando.

### Por qué llamarlas a mano no sirve

Las cuatro funciones se pueden llamar por la API con la clave *publishable* (y las de `ai_usage`, con la sesión). Están hechas para que eso no ayude:

| Función | Lo que consigue quien la llama a mano |
|---|---|
| `login_attempt_begin` | Sumar intentos: bloquearse antes. No prueba ningún código (para eso hace falta `LOGIN_CODE_PEPPER`, que solo tiene el servidor). |
| `login_attempt_clear` | Nada sin sesión; con sesión ya está dentro. |
| `ai_usage_reserve` | Añadir filas de uso. La llamada a la IA la hace el servidor, no la reserva: reservar a mano solo gasta cupo. Pasar límites falsos solo afecta a esa llamada, no a la del servidor. |
| `ai_usage_settle` | Cerrar reservas propias hechas a mano. Las del servidor no: falta el resguardo. |

## Alternativas consideradas

- **La clave *secret* de Supabase en el servidor de la app**, para escribir con ella. Es lo habitual y lo más corto, pero rompe una regla del proyecto (la clave *secret* nunca sale del ordenador del dueño) y convierte cualquier fallo del servidor en acceso total a la base de datos.
- **Un secreto nuevo que las funciones comprueban.** Deja la escritura reservada al servidor sin la clave *secret*, pero obliga a guardarlo en Vercel y su huella en la base de datos, con un paso manual más en cada despliegue. No hace falta: con el resguardo por reserva se consigue lo mismo.
- **Solo quitar el permiso de borrar `writing_submissions`.** El usuario necesita editar esa tabla (reescrituras, autoevaluación), y con poder cambiar `cost_usd` basta para saltarse el tope.
- **Bloqueo definitivo tras N intentos, hasta entrar por correo.** Más duro contra la fuerza bruta, pero deja a cualquiera que sepa el email cerrar el acceso con código para siempre con diez peticiones.
- **Limitar por IP en la app.** En Vercel no hay dónde guardar el contador sin otro servicio, y quien ataca cambia de IP.

## Consecuencias

- **Un código obvio sigue siendo un código obvio.** El bloqueo deja unos 15 intentos el primer día y después uno al día: con un código de cuatro cifras al azar hacen falta, de media, más de diez años; con `123456` o una fecha, días. Hay que elegir un código que nadie probaría.
- **Quien sepa el email puede cerrar el acceso con código** mandando códigos falsos (con una petición al día lo mantiene cerrado). El dueño entra entonces con el enlace del correo, que además lo reabre, o ejecuta `pnpm auth:set-code`. Es el precio de cualquier bloqueo por cuenta.
- El bloqueo solo cubre lo que pasa por la app. El código fijo no se puede probar de otra forma; el código de seis cifras del correo sí se puede probar directamente contra Supabase con la clave *publishable*, y ahí solo cuenta su límite por IP.
- `login_attempt_begin` responde distinto para un email con cuenta (acaba bloqueándose) que para uno sin ella. Supabase ya lo distingue en `signInWithOtp` y el email es público: no se pierde nada.
- **Orden al desplegar:** primero las migraciones 0005 y 0006, después el código. Con el código nuevo y sin las funciones, el acceso con código y la corrección con IA fallan (cerrados, no abiertos).
- Las funciones de negocio dejan de ser todas `security invoker`: estas cuatro son `security definer`, con `search_path` vacío y comprobando `auth.uid()` dentro.
- El límite de gasto en la consola de Anthropic sigue siendo la última barrera, fuera de la app.
- Tests: `tests/db/login-attempts.test.ts`, `tests/db/ai-usage.test.ts` y los e2e de acceso y escritura.
