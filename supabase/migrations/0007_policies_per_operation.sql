-- Señal · 0007 · Políticas RLS por operación (ADR-0025)
--
-- Hasta aquí cada tabla tenía una sola política `for all`: el usuario podía leer, crear,
-- cambiar y borrar sus filas, también en tablas donde la app nunca borra ni cambia nada. Eso
-- le daba a quien tuviera su sesión más de lo necesario: borrar el historial de intentos,
-- reescribir repasos ya hechos, vaciar el léxico…
--
-- Ahora cada tabla tiene una política por operación, y solo las que usa la app (directamente
-- o a través de sus funciones SQL, que son `security invoker` y pasan por RLS). Lo que no
-- aparece aquí queda denegado: con RLS activo, una operación sin política no toca ninguna fila.
--
--   tabla                   select  insert  update  delete
--   profiles                  ✓       ✓       ✓       ·     (el alta la hace el trigger; si falta, la app)
--   skill_ratings             ✓       ✓       ✓       ·
--   lesson_progress           ✓       ✓       ✓       ·
--   lexicon                   ✓       ✓       ✓       ·
--   srs_cards                 ✓       ✓       ✓       ·     (una tarjeta se pausa, no se borra)
--   writing_submissions       ✓       ✓       ✓       ·
--   activity_days             ✓       ✓       ✓       ·     (add_activity)
--   input_log                 ✓       ✓       ✓       ✓     (el único sitio donde la app borra)
--   item_attempts             ✓       ✓       ·       ·     historial: solo se añade
--   srs_reviews               ✓       ✓       ·       ·     historial: solo se añade
--   rating_history            ✓       ✓       ·       ·     historial: solo se añade
--   listening_diagnostics     ✓       ✓       ·       ·     historial: solo se añade
--   daily_plans               ✓       ·       ·       ·     sin uso todavía
--   placement_results         ✓       ·       ·       ·     sin uso todavía
--   achievements              ✓       ·       ·       ·     sin uso todavía
--   ai_usage, login_attempts  ✓       ·       ·       ·     (ya eran así: migraciones 0005 y 0006)
--
-- Las tres tablas sin uso se quedan en solo lectura: la política de escritura se añadirá, en
-- su propia migración, con la función que las empiece a usar.

-- ---------- Perfil ----------
drop policy "own profile" on public.profiles;
create policy "own profile: select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------- Leer, crear y cambiar ----------
drop policy "own rows" on public.skill_ratings;
create policy "own rows: select" on public.skill_ratings for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.skill_ratings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.skill_ratings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.lesson_progress;
create policy "own rows: select" on public.lesson_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.lesson_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.lesson_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.lexicon;
create policy "own rows: select" on public.lexicon for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.lexicon for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.lexicon for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.srs_cards;
create policy "own rows: select" on public.srs_cards for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.srs_cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.srs_cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.writing_submissions;
create policy "own rows: select" on public.writing_submissions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.writing_submissions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.writing_submissions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.activity_days;
create policy "own rows: select" on public.activity_days for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.activity_days for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.activity_days for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Las cuatro operaciones ----------
drop policy "own rows" on public.input_log;
create policy "own rows: select" on public.input_log for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.input_log for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.input_log for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.input_log for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Historiales: leer y añadir ----------
drop policy "own rows" on public.item_attempts;
create policy "own rows: select" on public.item_attempts for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.item_attempts for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.srs_reviews;
create policy "own rows: select" on public.srs_reviews for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.srs_reviews for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.rating_history;
create policy "own rows: select" on public.rating_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.rating_history for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy "own rows" on public.listening_diagnostics;
create policy "own rows: select" on public.listening_diagnostics for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.listening_diagnostics for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------- Sin uso todavía: solo leer ----------
drop policy "own rows" on public.daily_plans;
create policy "own rows: select" on public.daily_plans for select to authenticated using ((select auth.uid()) = user_id);

drop policy "own rows" on public.placement_results;
create policy "own rows: select" on public.placement_results for select to authenticated using ((select auth.uid()) = user_id);

drop policy "own rows" on public.achievements;
create policy "own rows: select" on public.achievements for select to authenticated using ((select auth.uid()) = user_id);
