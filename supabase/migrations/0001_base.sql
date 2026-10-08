-- =========================================================
-- Señal · migración base
-- =========================================================

-- ---------- Tipos ----------
create type public.cefr as enum ('A1','A2','B1','B2','C1','C2');
create type public.skill as enum ('listening','reading','vocabulary','grammar','writing','speaking');
create type public.lesson_status as enum ('started','completed');
create type public.lexeme_status as enum ('new','learning','known','ignored');
create type public.lexeme_source as enum ('placement','manual','srs','implicit','lesson');
create type public.card_kind as enum ('word','chunk','audio','grammar','production');
create type public.diag_cause as enum ('unknown_word','not_recognized','boundaries','speed','accent','attention');
create type public.input_kind as enum ('intensive_listening','extensive_listening','intensive_reading','extensive_reading');
create type public.input_source as enum ('app','external');

-- ---------- Perfil ----------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  native_language     text not null default 'es',
  ui_locale           text not null default 'es' check (ui_locale in ('es','en')),
  timezone            text not null default 'Europe/Madrid',
  daily_goal_min      int  not null default 45 check (daily_goal_min between 10 and 240),
  streak_min_minutes  int  not null default 15 check (streak_min_minutes between 5 and 120),
  interests           text[] not null default '{}',
  declared_level      public.cefr,
  settings            jsonb not null default '{}'::jsonb,  -- tema, tamaño de letra, velocidad, fsrs_params…
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Nivel ----------
create table public.skill_ratings (
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill            public.skill not null,
  rating           real not null default 1100,
  items_count      int  not null default 0,
  confirmed_level  public.cefr,
  confirmed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, skill)
);

create table public.rating_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill        public.skill not null,
  rating       real not null,
  recorded_at  timestamptz not null default now()
);
create index rating_history_user_idx on public.rating_history (user_id, skill, recorded_at);

-- ---------- Progreso ----------
create table public.lesson_progress (
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id           text not null,
  lesson_version      int  not null default 1,
  status              public.lesson_status not null default 'started',
  phase               smallint not null default 0,
  score               real check (score between 0 and 1),
  best_score          real check (best_score between 0 and 1),
  attempts            int  not null default 0,
  time_spent_s        int  not null default 0,
  reading_wpm         real,
  self_rating_initial smallint check (self_rating_initial between 0 and 100),
  self_rating_final   smallint check (self_rating_final between 0 and 100),
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.item_attempts (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id        text not null,
  item_id          text not null,                 -- 'b1-lis-001:q3'
  skill            public.skill not null,
  task_type        text not null,
  focus            text,
  phase            text,
  item_difficulty  real not null,
  rating_before    real not null,
  score            real not null check (score between 0 and 1),
  response         jsonb not null default '{}'::jsonb,
  duration_ms      int,
  client_id        uuid not null,                 -- idempotencia (cola sin conexión)
  created_at       timestamptz not null default now(),
  unique (user_id, client_id)
);
create index item_attempts_user_time_idx on public.item_attempts (user_id, created_at desc);
create index item_attempts_user_lesson_idx on public.item_attempts (user_id, lesson_id);

create table public.listening_diagnostics (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id      text not null,
  segment_id     text not null,
  cause          public.diag_cause not null,
  cause_source   text not null default 'auto' check (cause_source in ('auto','user')),
  expected       text not null,                   -- tramo de referencia fallado
  typed          text,                            -- lo que escribiste
  features       text[] not null default '{}',    -- rasgos de habla conectada del tramo
  playback_rate  real not null default 1,
  created_at     timestamptz not null default now()
);
create index listening_diag_user_time_idx on public.listening_diagnostics (user_id, created_at desc);

-- ---------- Léxico y SRS ----------
create table public.lexicon (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lemma          text not null,
  status         public.lexeme_status not null,
  source         public.lexeme_source not null,
  cefr           public.cefr,
  seen_count     int not null default 0,
  lookup_count   int not null default 0,
  first_seen_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, lemma)
);
create index lexicon_user_status_idx on public.lexicon (user_id, status);

create table public.srs_cards (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind               public.card_kind not null,
  lemma              text,
  front              jsonb not null,
  back               jsonb not null,
  source_lesson_id   text,
  source_segment_id  text,
  -- Estado FSRS: espejo de Card de ts-fsrs (ajusta a la versión instalada)
  due                timestamptz not null default now(),
  stability          real not null default 0,
  difficulty         real not null default 0,
  elapsed_days       int  not null default 0,
  scheduled_days     int  not null default 0,
  learning_steps     int  not null default 0,
  reps               int  not null default 0,
  lapses             int  not null default 0,
  state              smallint not null default 0,  -- 0 New · 1 Learning · 2 Review · 3 Relearning
  last_review        timestamptz,
  suspended          boolean not null default false,
  created_at         timestamptz not null default now(),
  unique nulls not distinct (user_id, kind, lemma, source_segment_id)
);
create index srs_cards_due_idx on public.srs_cards (user_id, due) where not suspended;

create table public.srs_reviews (
  id                 bigint generated always as identity primary key,
  card_id            uuid not null references public.srs_cards(id) on delete cascade,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating             smallint not null check (rating between 1 and 4),  -- Again · Hard · Good · Easy
  state              smallint not null,
  due                timestamptz not null,
  stability          real not null,
  difficulty         real not null,
  elapsed_days       int  not null,
  last_elapsed_days  int  not null,
  scheduled_days     int  not null,
  learning_steps     int  not null default 0,
  review             timestamptz not null,
  duration_ms        int,
  client_id          uuid not null,
  unique (user_id, client_id)
);
create index srs_reviews_user_time_idx on public.srs_reviews (user_id, review desc);

-- ---------- Input, actividad y plan ----------
create table public.input_log (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind             public.input_kind not null,
  source           public.input_source not null,
  minutes          real not null check (minutes > 0 and minutes <= 600),
  words            int check (words >= 0),
  title            text,
  url              text,
  perceived_level  public.cefr,
  accent           text,
  lesson_id        text,
  logged_on        date not null,
  created_at       timestamptz not null default now()
);
create index input_log_user_day_idx on public.input_log (user_id, logged_on desc);

create table public.activity_days (
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day             date not null,
  active_seconds  int not null default 0,
  xp              int not null default 0,
  goal_met        boolean not null default false,
  freeze_used     boolean not null default false,
  primary key (user_id, day)
);

create table public.daily_plans (
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day             date not null,
  items           jsonb not null,
  engine_version  int not null default 1,
  created_at      timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- Writing ----------
create table public.writing_submissions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prompt_id      text,
  task_type      text not null,
  target_level   public.cefr not null,
  text           text not null check (char_length(text) <= 6000),
  word_count     int  not null,
  feedback       jsonb,
  status         text not null default 'pending' check (status in ('pending','done','error')),
  model          text,
  input_tokens   int,
  output_tokens  int,
  cost_usd       numeric(10,5) not null default 0,
  rewrite_text   text,
  created_at     timestamptz not null default now()
);
create index writing_user_time_idx on public.writing_submissions (user_id, created_at desc);

-- ---------- Evaluación y logros ----------
create table public.placement_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('placement','confirmation')),
  skill         public.skill,
  target_level  public.cefr,
  score         real,
  passed        boolean,
  details       jsonb not null,
  taken_at      timestamptz not null default now()
);

create table public.achievements (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code         text not null,
  unlocked_at  timestamptz not null default now(),
  primary key (user_id, code)
);

-- =========================================================
-- RLS: cada usuario solo ve y toca sus filas
-- =========================================================
alter table public.profiles              enable row level security;
alter table public.skill_ratings         enable row level security;
alter table public.rating_history        enable row level security;
alter table public.lesson_progress       enable row level security;
alter table public.item_attempts         enable row level security;
alter table public.listening_diagnostics enable row level security;
alter table public.lexicon               enable row level security;
alter table public.srs_cards             enable row level security;
alter table public.srs_reviews           enable row level security;
alter table public.input_log             enable row level security;
alter table public.activity_days         enable row level security;
alter table public.daily_plans           enable row level security;
alter table public.writing_submissions   enable row level security;
alter table public.placement_results     enable row level security;
alter table public.achievements          enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own rows" on public.skill_ratings         for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.rating_history        for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.lesson_progress       for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.item_attempts         for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.listening_diagnostics for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.lexicon               for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.srs_cards             for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.srs_reviews           for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.input_log             for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.activity_days         for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.daily_plans           for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.writing_submissions   for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.placement_results     for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.achievements          for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- =========================================================
-- Funciones y triggers
-- =========================================================

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch       before update on public.profiles        for each row execute function public.touch_updated_at();
create trigger lexicon_touch        before update on public.lexicon         for each row execute function public.touch_updated_at();
create trigger lesson_progress_touch before update on public.lesson_progress for each row execute function public.touch_updated_at();

-- Perfil y ratings iniciales al crear el usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.skill_ratings (user_id, skill, rating)
  select new.id, s, 1100 from unnest(enum_range(null::public.skill)) as s;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Aplicar el resultado de una fase/lección en una sola transacción.
-- Los ratings los calcula el servidor (lib/elo.ts) y llegan ya resueltos.
create or replace function public.apply_lesson_attempts(
  p_lesson_id       text,
  p_lesson_version  int,
  p_attempts        jsonb,   -- [{ item_id, skill, task_type, focus, phase, item_difficulty, rating_before, score, response, duration_ms, client_id, created_at }]
  p_ratings         jsonb,   -- { "listening": { "rating": 1093.5, "items": 212 } }
  p_progress        jsonb    -- { status, phase, score, time_spent_s, reading_wpm }
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
    insert into public.skill_ratings (user_id, skill, rating, items_count, updated_at)
    values (v_user, v_skill::public.skill, (v_val->>'rating')::real, (v_val->>'items')::int, now())
    on conflict (user_id, skill) do update
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
    insert into public.rating_history (user_id, skill, rating)
    select v_user, sr.skill, sr.rating
    from public.skill_ratings sr
    where sr.user_id = v_user
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

revoke execute on function public.apply_lesson_attempts(text, int, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.apply_lesson_attempts(text, int, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.add_activity(date, int, int) from public, anon;
grant  execute on function public.add_activity(date, int, int) to authenticated;

-- =========================================================
-- Vistas (respetan RLS con security_invoker)
-- =========================================================
-- Meses en hora de Madrid (para la pantalla de progreso; el límite de la API se calcula en código)
create view public.v_ai_spend_month with (security_invoker = true) as
select user_id,
       date_trunc('month', created_at at time zone 'Europe/Madrid')::date as month,
       count(*)                   as requests,
       coalesce(sum(cost_usd), 0) as cost_usd
from public.writing_submissions
where status = 'done'
group by user_id, date_trunc('month', created_at at time zone 'Europe/Madrid')::date;

create view public.v_input_weekly with (security_invoker = true) as
select user_id,
       date_trunc('week', logged_on::timestamp)::date as week,
       kind,
       sum(minutes) as minutes,
       coalesce(sum(words), 0) as words
from public.input_log
group by user_id, date_trunc('week', logged_on::timestamp)::date, kind;
