-- Señal · 0002 · Guardar repasos del SRS
--
-- Aplica un lote de repasos en una sola transacción: por cada uno inserta la fila de
-- `srs_reviews` y, solo si es nueva, actualiza el estado FSRS de su tarjeta. Es idempotente por
-- `client_id`: reenviar un lote (reintento sin conexión) no programa una tarjeta dos veces.
--
-- El estado nuevo de cada tarjeta lo calcula el servidor con ts-fsrs (features/srs/lib/scheduler)
-- a partir del estado guardado y llega ya resuelto, igual que los ratings en
-- `apply_lesson_attempts`.

create or replace function public.apply_reviews(
  p_reviews jsonb   -- [{ card_id, client_id, duration_ms, card: { due, stability, … }, log: { rating, state, due, … } }]
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_item    jsonb;
  v_card    jsonb;
  v_log     jsonb;
  v_applied int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  for v_item in select value from jsonb_array_elements(p_reviews) loop
    v_card := v_item->'card';
    v_log  := v_item->'log';

    insert into public.srs_reviews (
      card_id, user_id, rating, state, due, stability, difficulty, elapsed_days,
      last_elapsed_days, scheduled_days, learning_steps, review, duration_ms, client_id
    )
    select c.id, v_user, (v_log->>'rating')::smallint, (v_log->>'state')::smallint,
           (v_log->>'due')::timestamptz, (v_log->>'stability')::real,
           (v_log->>'difficulty')::real, (v_log->>'elapsed_days')::int,
           (v_log->>'last_elapsed_days')::int, (v_log->>'scheduled_days')::int,
           coalesce((v_log->>'learning_steps')::int, 0), (v_log->>'review')::timestamptz,
           (v_item->>'duration_ms')::int, (v_item->>'client_id')::uuid
    from public.srs_cards c
    where c.id = (v_item->>'card_id')::uuid
      and c.user_id = v_user
    on conflict (user_id, client_id) do nothing;

    -- Sin fila nueva (repaso ya guardado o tarjeta ajena), la tarjeta no se toca.
    if found then
      update public.srs_cards set
        due            = (v_card->>'due')::timestamptz,
        stability      = (v_card->>'stability')::real,
        difficulty     = (v_card->>'difficulty')::real,
        elapsed_days   = (v_card->>'elapsed_days')::int,
        scheduled_days = (v_card->>'scheduled_days')::int,
        learning_steps = coalesce((v_card->>'learning_steps')::int, 0),
        reps           = (v_card->>'reps')::int,
        lapses         = (v_card->>'lapses')::int,
        state          = (v_card->>'state')::smallint,
        last_review    = (v_card->>'last_review')::timestamptz
      where id = (v_item->>'card_id')::uuid
        and user_id = v_user;
      v_applied := v_applied + 1;
    end if;
  end loop;

  return v_applied;
end;
$$;

revoke execute on function public.apply_reviews(jsonb) from public, anon;
grant  execute on function public.apply_reviews(jsonb) to authenticated;
