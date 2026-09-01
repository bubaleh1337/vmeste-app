-- Stage 4.3: per-profile presentation preferences. Safe additive migration.
alter table public.profiles add column if not exists theme_key text not null default 'sage';
alter table public.profiles add column if not exists font_key text not null default 'onest';

alter table public.profiles drop constraint if exists profiles_theme_key_check;
alter table public.profiles add constraint profiles_theme_key_check check (theme_key in ('sage','rose','lavender','ocean','sky','honey'));
alter table public.profiles drop constraint if exists profiles_font_key_check;
alter table public.profiles add constraint profiles_font_key_check check (font_key in ('onest','manrope','system'));
