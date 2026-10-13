-- Señal · 0005 · Bloqueo por intentos de acceso (ADR-0024)
--
-- La app anota cada intento de entrar con un código ANTES de probarlo. Tras varios seguidos sin
-- acertar, deja de admitir más durante un tiempo que se va doblando. Hasta ahora lo único que
-- frenaba una fuerza bruta era el límite de Supabase por IP, y la IP que ve Supabase es la del
-- servidor de la app, no la de quien prueba.
--
-- El usuario solo puede leer su fila. Se escribe con dos funciones `security definer`:
--   · login_attempt_begin  la llama la app sin sesión (rol anon): solo sabe sumar intentos.
--   · login_attempt_clear  borra la cuenta, y solo vale con sesión: hay que haber entrado.
-- Llamarlas a mano contra la API no ayuda a quien ataca: con la primera solo consigue
-- bloquearse antes, y la segunda no la puede usar.

create table public.login_attempts (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  attempts         int not null default 0 check (attempts >= 0),  -- seguidos, desde el último acceso
  last_attempt_at  timestamptz,
  locked_until     timestamptz
);

alter table public.login_attempts enable row level security;

create policy "own row, read only" on public.login_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Sin políticas de escritura, RLS ya la impide; se retiran además los permisos de tabla.
revoke all on table public.login_attempts from anon, authenticated;
grant select on table public.login_attempts to authenticated;

-- Anota un intento y dice si se puede probar el código. Se admiten cinco seguidos; desde el
-- quinto, cada intento deja el acceso cerrado 1, 2, 4, 8… minutos, hasta 24 horas.
create or replace function public.login_attempt_begin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid;
  v_row      public.login_attempts;
  v_attempts int;
begin
  select id into v_user from auth.users where email = lower(trim(p_email)) limit 1;
  -- Un email sin cuenta no tiene nada que proteger: no se guarda nada.
  if v_user is null then
    return jsonb_build_object('allowed', true, 'retry_after_s', 0);
  end if;

  insert into public.login_attempts (user_id) values (v_user)
  on conflict (user_id) do nothing;
  -- La fila queda bloqueada hasta el final: dos intentos a la vez no se cuentan como uno.
  select * into v_row from public.login_attempts where user_id = v_user for update;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_s', ceil(extract(epoch from v_row.locked_until - now()))::int
    );
  end if;

  v_attempts := v_row.attempts + 1;
  update public.login_attempts
     set attempts        = v_attempts,
         last_attempt_at = now(),
         locked_until    = case when v_attempts >= 5 then
                             now() + least(
                               interval '1 minute' * power(2, least(v_attempts - 5, 11)),
                               interval '24 hours'
                             )
                           end
   where user_id = v_user;

  return jsonb_build_object('allowed', true, 'retry_after_s', 0);
end;
$$;

-- Tras entrar (con el código o con el enlace del correo), la cuenta vuelve a cero.
create or replace function public.login_attempt_clear()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.login_attempts where user_id = (select auth.uid());
end;
$$;

revoke execute on function public.login_attempt_begin(text) from public;
grant  execute on function public.login_attempt_begin(text) to anon, authenticated;
revoke execute on function public.login_attempt_clear() from public, anon;
grant  execute on function public.login_attempt_clear() to authenticated;
