-- Señal · 0008 · Cinco idiomas de interfaz (ADR-0032)
--
-- La interfaz pasa de español e inglés a cinco idiomas: español, inglés, francés, chino
-- (simplificado) y japonés. El perfil guarda el que elige cada usuario en Ajustes; la
-- restricción solo admitía 'es' y 'en'. Los perfiles que ya existen no cambian.

alter table public.profiles drop constraint profiles_ui_locale_check;

alter table public.profiles
  add constraint profiles_ui_locale_check check (ui_locale in ('es', 'en', 'fr', 'zh', 'ja'));
