-- Repair system category names that may have been corrupted by Windows PowerShell 5.1 encoding.
-- This migration is intentionally ASCII-only; PostgreSQL decodes U& Unicode escapes itself.

update public.expense_categories
set name = case key
  when 'groceries' then U&'\041F\0440\043E\0434\0443\043A\0442\044B'
  when 'cafes' then U&'\041A\0430\0444\0435 \0438 \0440\0435\0441\0442\043E\0440\0430\043D\044B'
  when 'transport' then U&'\0422\0440\0430\043D\0441\043F\043E\0440\0442'
  when 'housing' then U&'\0416\0438\043B\044C\0451 \0438 \043A\043E\043C\043C\0443\043D\0430\043B\044C\043D\044B\0435 \0443\0441\043B\0443\0433\0438'
  when 'health' then U&'\0417\0434\043E\0440\043E\0432\044C\0435 \0438 \0430\043F\0442\0435\043A\0438'
  when 'beauty' then U&'\041A\0440\0430\0441\043E\0442\0430 \0438 \0443\0445\043E\0434'
  when 'shopping' then U&'\041E\0434\0435\0436\0434\0430 \0438 \043F\043E\043A\0443\043F\043A\0438'
  when 'subscriptions' then U&'\041F\043E\0434\043F\0438\0441\043A\0438 \0438 \0441\0432\044F\0437\044C'
  when 'entertainment' then U&'\0420\0430\0437\0432\043B\0435\0447\0435\043D\0438\044F'
  when 'education' then U&'\041E\0431\0440\0430\0437\043E\0432\0430\043D\0438\0435'
  when 'travel' then U&'\041F\0443\0442\0435\0448\0435\0441\0442\0432\0438\044F'
  when 'pets' then U&'\041F\0438\0442\043E\043C\0446\044B'
  when 'gifts' then U&'\041F\043E\0434\0430\0440\043A\0438 \0438 \043F\043E\043C\043E\0449\044C'
  when 'taxes_fees' then U&'\041D\0430\043B\043E\0433\0438 \0438 \043A\043E\043C\0438\0441\0441\0438\0438'
  when 'transfers' then U&'\041F\0435\0440\0435\0432\043E\0434\044B'
  when 'cash' then U&'\041D\0430\043B\0438\0447\043D\044B\0435'
  when 'other' then U&'\0414\0440\0443\0433\043E\0435'
  when 'needs_review' then U&'\0422\0440\0435\0431\0443\0435\0442 \043F\0440\043E\0432\0435\0440\043A\0438'
  else name
end
where goal_id is null and is_system = true and key in (
  'groceries',
  'cafes',
  'transport',
  'housing',
  'health',
  'beauty',
  'shopping',
  'subscriptions',
  'entertainment',
  'education',
  'travel',
  'pets',
  'gifts',
  'taxes_fees',
  'transfers',
  'cash',
  'other',
  'needs_review'
);
