begin;

insert into public.expense_categories (
  goal_id,
  key,
  name,
  icon,
  color,
  default_discretionary,
  is_system
)
select
  null,
  'sports_fitness',
  U&'\0421\043F\043E\0440\0442 \0438 \0444\0438\0442\043D\0435\0441',
  'dumbbell',
  '#7B927A',
  false,
  true
where not exists (
  select 1
  from public.expense_categories
  where goal_id is null
    and key = 'sports_fitness'
);

update public.expense_categories
set
  name = U&'\0421\043F\043E\0440\0442 \0438 \0444\0438\0442\043D\0435\0441',
  icon = 'dumbbell',
  color = coalesce(color, '#7B927A'),
  default_discretionary = false,
  is_system = true,
  archived_at = null
where goal_id is null
  and key = 'sports_fitness';

commit;
