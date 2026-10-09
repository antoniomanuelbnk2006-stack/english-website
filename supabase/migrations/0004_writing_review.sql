-- =========================================================
-- Señal · writing: revisión sin IA y datos de la sesión (ADR-0014)
-- =========================================================
-- Una entrega puede corregirla la IA o revisarla el propio usuario con las comprobaciones
-- automáticas y la respuesta modelo. `review_kind` distingue las dos: el límite diario y el
-- tope de gasto solo cuentan las que se enviaron a la IA.

alter table public.writing_submissions
  add column review_kind    text not null default 'ai' check (review_kind in ('ai','self')),
  add column active_seconds int  not null default 0 check (active_seconds >= 0),
  add column exam_mode      boolean not null default false,
  add column rewritten_at   timestamptz;

comment on column public.writing_submissions.review_kind is
  'ai = enviada a la IA (cuenta para los límites) · self = revisada sin IA';
comment on column public.writing_submissions.active_seconds is
  'Tiempo activo escribiendo, en segundos';
comment on column public.writing_submissions.exam_mode is
  'Escrita en modo examen: con tiempo y sin ayudas';
