-- Señal · 0003 · Escucha con transcripción desde el principio (ADR-0013)
--
-- Una lección de escucha se puede hacer «a ciegas» (el ciclo diagnóstico) o «con
-- transcripción». Si el usuario elige ver el texto antes de completar las dos escuchas a
-- ciegas, queda anotado aquí: el servidor puede entonces entregar la transcripción, y esa
-- lección deja de servir como medida de su oído.

alter table public.lesson_progress
  add column transcript_first boolean not null default false;

comment on column public.lesson_progress.transcript_first is
  'El usuario eligió ver la transcripción antes de completar las dos escuchas a ciegas.';
