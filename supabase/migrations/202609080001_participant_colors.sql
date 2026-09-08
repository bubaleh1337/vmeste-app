begin;

alter table public.profiles
  add column if not exists participant_color text;

alter table public.profiles
  drop constraint if exists profiles_participant_color_check;

alter table public.profiles
  add constraint profiles_participant_color_check
  check (participant_color is null or participant_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.profiles.participant_color is
  'User-selected color for contribution segments. Only the profile owner can update it under profiles_update RLS.';

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

commit;
