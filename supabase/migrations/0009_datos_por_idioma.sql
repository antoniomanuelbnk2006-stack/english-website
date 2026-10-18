-- Señal · 0009 · Los datos del usuario, por idioma (ADR-0037)
--
-- Con varios idiomas para practicar (ADR-0036), lo que depende de la lengua se guarda por idioma:
--   · el nivel que declara el usuario      → tabla nueva `language_levels`
--   · los niveles por destreza (Elo)       → `skill_ratings` y `rating_history`, con `language`
--   · el léxico y las tarjetas de repaso   → `lexicon` y `srs_cards`, con `language`
-- Lo que ya está ligado a un contenido (progreso de lecciones, intentos, entregas de writing) no
-- cambia: el idioma se lee del id (`es-a1-rea-001`). La actividad, la racha y los límites de la IA
-- siguen siendo del usuario, no de un idioma.
--
-- Los datos que ya existen son de inglés: las columnas nuevas valen 'en' por defecto, así que no se
-- pierde ni se mueve nada. `profiles.declared_level` se copia a `language_levels` pero se deja
-- donde está (la app ya no lo lee): quitarla es una migración aparte cuando todo esté probado.

-- ---------- Nivel declarado, por idioma ----------
create table public.language_levels (
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  language        text not null check (language in ('es', 'en', 'fr', 'zh', 'ja')),
  declared_level  public.cefr not null,
  updated_at      timestamptz not null default now(),
  primary key (user_id, language)
);
alter table public.language_levels enable row level security;
create policy "own rows: select" on public.language_levels for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.language_levels for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.language_levels for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger language_levels_touch before update on public.language_levels for each row execute function public.touch_updated_at();

insert into public.language_levels (user_id, language, declared_level)
select id, 'en', declared_level from public.profiles where declared_level is not null;

-- ---------- Niveles por destreza ----------
alter table public.skill_ratings
  add column language text not null default 'en' check (language in ('es', 'en', 'fr', 'zh', 'ja'));
alter table public.skill_ratings drop constraint skill_ratings_pkey;
alter table public.skill_ratings add primary key (user_id, language, skill);

alter table public.rating_history
  add column language text not null default 'en' check (language in ('es', 'en', 'fr', 'zh', 'ja'));
drop index public.rating_history_user_idx;
create index rating_history_user_idx on public.rating_history (user_id, language, skill, recorded_at);

-- ---------- Léxico y tarjetas ----------
-- Un mismo lema puede existir en dos idiomas («come» en inglés y en español): la clave lleva el idioma.
alter table public.lexicon
  add column language text not null default 'en' check (language in ('es', 'en', 'fr', 'zh', 'ja'));
alter table public.lexicon drop constraint lexicon_pkey;
alter table public.lexicon add primary key (user_id, language, lemma);
drop index public.lexicon_user_status_idx;
create index lexicon_user_status_idx on public.lexicon (user_id, language, status);

alter table public.srs_cards
  add column language text not null default 'en' check (language in ('es', 'en', 'fr', 'zh', 'ja'));
alter table public.srs_cards drop constraint srs_cards_user_id_kind_lemma_source_segment_id_key;
alter table public.srs_cards
  add constraint srs_cards_unique_card unique nulls not distinct (user_id, language, kind, lemma, source_segment_id);
drop index public.srs_cards_due_idx;
create index srs_cards_due_idx on public.srs_cards (user_id, language, due) where not suspended;

-- ---------- Guardar el resultado de una lección ----------
-- Igual que antes, más el idioma de la lección: sus ratings son de ese idioma. La firma cambia
-- (un parámetro con valor por defecto), así que se quita la anterior.
drop function public.apply_lesson_attempts(text, int, jsonb, jsonb, jsonb);

create or replace function public.apply_lesson_attempts(
  p_lesson_id       text,
  p_lesson_version  int,
  p_attempts        jsonb,   -- [{ item_id, skill, task_type, focus, phase, item_difficulty, rating_before, score, response, duration_ms, client_id, created_at }]
  p_ratings         jsonb,   -- { "listening": { "rating": 1093.5, "items": 212 } }
  p_progress        jsonb,   -- { status, phase, score, time_spent_s, reading_wpm }
  p_language        text default 'en'  -- idioma de la lección: sus ratings son de ese idioma
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_skill text;
  v_val   jsonb;
  v_lang  text := coalesce(p_language, 'en');
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.item_attempts (
    user_id, lesson_id, item_id, skill, task_type, focus, phase,
    item_difficulty, rating_before, score, response, duration_ms, client_id, created_at
  )
  select v_user, p_lesson_id, a->>'item_id', (a->>'skill')::public.skill, a->>'task_type',
         a->>'focus', a->>'phase', (a->>'item_difficulty')::real, (a->>'rating_before')::real,
         (a->>'score')::real, coalesce(a->'response', '{}'::jsonb), (a->>'duration_ms')::int,
         (a->>'client_id')::uuid, coalesce((a->>'created_at')::timestamptz, now())
  from jsonb_array_elements(p_attempts) as a
  on conflict (user_id, client_id) do nothing;

  for v_skill, v_val in select key, value from jsonb_each(p_ratings) loop
    insert into public.skill_ratings (user_id, language, skill, rating, items_count, updated_at)
    values (v_user, v_lang, v_skill::public.skill, (v_val->>'rating')::real, (v_val->>'items')::int, now())
    on conflict (user_id, language, skill) do update
      set rating = excluded.rating,
          items_count = excluded.items_count,
          updated_at = now();
  end loop;

  insert into public.lesson_progress as lp (
    user_id, lesson_id, lesson_version, status, phase, score, best_score,
    attempts, time_spent_s, reading_wpm, completed_at
  ) values (
    v_user, p_lesson_id, p_lesson_version,
    coalesce((p_progress->>'status')::public.lesson_status, 'started'),
    coalesce((p_progress->>'phase')::smallint, 0),
    (p_progress->>'score')::real,
    (p_progress->>'score')::real,
    case when p_progress->>'status' = 'completed' then 1 else 0 end,
    coalesce((p_progress->>'time_spent_s')::int, 0),
    (p_progress->>'reading_wpm')::real,
    case when p_progress->>'status' = 'completed' then now() end
  )
  on conflict (user_id, lesson_id) do update set
    lesson_version = excluded.lesson_version,
    status       = case when lp.status = 'completed' then lp.status else excluded.status end,
    phase        = greatest(lp.phase, excluded.phase),
    score        = coalesce(excluded.score, lp.score),
    best_score   = greatest(coalesce(lp.best_score, 0), coalesce(excluded.score, 0)),
    attempts     = lp.attempts + excluded.attempts,
    time_spent_s = lp.time_spent_s + excluded.time_spent_s,
    reading_wpm  = coalesce(excluded.reading_wpm, lp.reading_wpm),
    completed_at = coalesce(lp.completed_at, excluded.completed_at);

  if p_progress->>'status' = 'completed' then
    insert into public.rating_history (user_id, language, skill, rating)
    select v_user, v_lang, sr.skill, sr.rating
    from public.skill_ratings sr
    where sr.user_id = v_user
      and sr.language = v_lang
      and sr.skill::text in (select jsonb_object_keys(p_ratings));
  end if;
end;
$$;

-- Sumar actividad del día (minutos activos y XP) y marcar el objetivo
create or replace function public.add_activity(p_day date, p_seconds int, p_xp int)
returns public.activity_days
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_goal int;
  v_row  public.activity_days;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select daily_goal_min * 60 into v_goal from public.profiles where id = v_user;

  insert into public.activity_days as ad (user_id, day, active_seconds, xp)
  values (v_user, p_day, greatest(p_seconds, 0), greatest(p_xp, 0))
  on conflict (user_id, day) do update
    set active_seconds = ad.active_seconds + excluded.active_seconds,
        xp             = ad.xp + excluded.xp
  returning * into v_row;

  if not v_row.goal_met and v_row.active_seconds >= coalesce(v_goal, 2700) then
    update public.activity_days
       set goal_met = true
     where user_id = v_user and day = p_day
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.apply_lesson_attempts(text, int, jsonb, jsonb, jsonb, text) from public, anon;
grant  execute on function public.apply_lesson_attempts(text, int, jsonb, jsonb, jsonb, text) to authenticated;
