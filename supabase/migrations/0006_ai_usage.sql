-- Señal · 0006 · Registro del uso de la IA que el usuario no puede tocar (ADR-0024)
--
-- El límite diario y el tope mensual de la corrección con IA se calculaban contando filas de
-- `writing_submissions`, que el propio usuario puede borrar o editar por la API (RLS `for all`):
-- quien tuviera su sesión podía poner el contador a cero y seguir gastando. Además, comprobar
-- el límite y registrar el envío eran dos pasos: varias peticiones a la vez pasaban todas.
--
-- Desde aquí el uso se lleva en `ai_usage`:
--   · El usuario solo puede LEER sus filas. No hay política ni permiso para insertar, cambiar
--     o borrar.
--   · `ai_usage_reserve` comprueba los dos límites y aparta el gasto de una llamada en una sola
--     operación, con un cerrojo por usuario: no hay carrera entre comprobar e insertar.
--   · `ai_usage_settle` cierra una reserva con lo que costó de verdad. Hace falta el resguardo
--     que `ai_usage_reserve` devolvió a quien la hizo (el servidor de la app): con la sesión
--     del usuario se ve la fila, pero no se puede cerrar ni abaratar.
--
-- Las dos funciones son `security definer` y se pueden llamar con la sesión del usuario, así
-- que están hechas para que llamarlas a mano no sirva de nada: reservar solo SUMA uso (la
-- llamada a la IA la hace el servidor, no la reserva) y una reserva sin cerrar cuenta por su
-- importe máximo.

create table public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  model          text not null,
  status         text not null default 'pending' check (status in ('pending','done','error')),
  reason         text check (reason in ('refusal','max_tokens','api')),  -- solo si status = 'error'
  reserved_usd   numeric(10,5) not null check (reserved_usd >= 0),      -- lo máximo que puede costar
  cost_usd       numeric(10,5) not null default 0 check (cost_usd >= 0), -- lo que costó (al cerrar)
  input_tokens   int,
  output_tokens  int,
  settle_hash    bytea,                           -- sha256 del resguardo; nulo al cerrar
  created_at     timestamptz not null default now(),
  settled_at     timestamptz,
  check ((status = 'error') = (reason is not null))
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

comment on table public.ai_usage is
  'Uso de la IA por llamada. Solo lectura para el usuario; se escribe con ai_usage_reserve/settle.';

alter table public.ai_usage enable row level security;

create policy "own rows, read only" on public.ai_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Sin políticas de escritura, RLS ya la impide; se retiran además los permisos de tabla.
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;

-- Lo que ya se había gastado sigue contando: los envíos a la IA hechos hasta ahora.
insert into public.ai_usage (
  user_id, model, status, reason, reserved_usd, cost_usd, input_tokens, output_tokens,
  created_at, settled_at
)
select user_id,
       coalesce(model, 'unknown'),
       case when status = 'done' then 'done' else 'error' end,
       case when status = 'done' then null
            when feedback->>'error' in ('refusal','max_tokens') then feedback->>'error'
            else 'api' end,                       -- un envío que se quedó a medias gastó un intento
       cost_usd, cost_usd, input_tokens, output_tokens, created_at, created_at
from public.writing_submissions
where review_kind = 'ai';

-- Comprueba los límites y aparta el gasto de una llamada. Devuelve
--   { "status": "ok", "id": …, "token": … }  ·  { "status": "daily_limit" }  ·  { "status": "monthly_budget" }
--
-- Mismas reglas que features/writing/lib/limits.ts:
--   · Al límite diario no le cuentan los envíos que el modelo rechazó o dejó a medias.
--   · Al tope mensual le cuenta todo lo cobrado; una reserva sin cerrar, por su importe máximo.
-- Los límites y el principio del día y del mes (hora de Madrid) los pone el servidor de la
-- app. Quien llame a mano con otros valores solo añade filas: nunca quita uso.
create or replace function public.ai_usage_reserve(
  p_model               text,
  p_reserve_usd         numeric,
  p_daily_limit         int,
  p_monthly_budget_usd  numeric,
  p_day_start           timestamptz,
  p_month_start         timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_today  int;
  v_spent  numeric;
  v_id     uuid;
  v_token  uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(p_model, '') = '' or p_reserve_usd is null or p_reserve_usd < 0
     or p_daily_limit is null or p_monthly_budget_usd is null
     or p_day_start is null or p_month_start is null then
    raise exception 'invalid arguments';
  end if;

  -- Una reserva cada vez por usuario: nadie cuenta mientras otro está a punto de insertar.
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:' || v_user::text, 0));

  select count(*) filter (
           where created_at >= p_day_start
             and not (status = 'error' and reason in ('refusal','max_tokens'))
         ),
         coalesce(
           sum(case when status = 'pending' then reserved_usd else cost_usd end)
             filter (where created_at >= p_month_start),
           0
         )
    into v_today, v_spent
    from public.ai_usage
   where user_id = v_user
     and created_at >= least(p_day_start, p_month_start);

  if v_today >= p_daily_limit then
    return jsonb_build_object('status', 'daily_limit');
  end if;
  if v_spent >= p_monthly_budget_usd then
    return jsonb_build_object('status', 'monthly_budget');
  end if;

  insert into public.ai_usage (user_id, model, reserved_usd, settle_hash)
  values (v_user, p_model, p_reserve_usd, sha256(convert_to(v_token::text, 'UTF8')))
  returning id into v_id;

  return jsonb_build_object('status', 'ok', 'id', v_id, 'token', v_token);
end;
$$;

-- Cierra una reserva con lo que la llamada costó de verdad. `p_outcome`: 'done', o el motivo
-- del fallo ('refusal', 'max_tokens', 'api'). Devuelve si ha cerrado algo: una reserva solo
-- se cierra una vez y solo con su resguardo.
create or replace function public.ai_usage_settle(
  p_id             uuid,
  p_token          uuid,
  p_outcome        text,
  p_cost_usd       numeric,
  p_input_tokens   int,
  p_output_tokens  int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_outcome is null or p_outcome not in ('done','refusal','max_tokens','api')
     or p_cost_usd is null or p_cost_usd < 0 then
    raise exception 'invalid arguments';
  end if;

  update public.ai_usage
     set status        = case when p_outcome = 'done' then 'done' else 'error' end,
         reason        = case when p_outcome = 'done' then null else p_outcome end,
         cost_usd      = p_cost_usd,
         input_tokens  = p_input_tokens,
         output_tokens = p_output_tokens,
         settle_hash   = null,
         settled_at    = now()
   where id = p_id
     and user_id = v_user
     and status = 'pending'
     and settle_hash = sha256(convert_to(p_token::text, 'UTF8'));

  return found;
end;
$$;

revoke execute on function public.ai_usage_reserve(text, numeric, int, numeric, timestamptz, timestamptz) from public, anon;
grant  execute on function public.ai_usage_reserve(text, numeric, int, numeric, timestamptz, timestamptz) to authenticated;
revoke execute on function public.ai_usage_settle(uuid, uuid, text, numeric, int, int) from public, anon;
grant  execute on function public.ai_usage_settle(uuid, uuid, text, numeric, int, int) to authenticated;

-- El gasto del mes (pantalla de progreso) sale ahora del registro que no se puede tocar.
create or replace view public.v_ai_spend_month with (security_invoker = true) as
select user_id,
       date_trunc('month', created_at at time zone 'Europe/Madrid')::date as month,
       count(*)                   as requests,
       coalesce(sum(cost_usd), 0) as cost_usd
from public.ai_usage
where status = 'done'
group by user_id, date_trunc('month', created_at at time zone 'Europe/Madrid')::date;
