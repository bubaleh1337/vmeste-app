# Закрытая beta: первый HTTPS-релиз

Эта инструкция создаёт отдельную beta-среду. Локальная разработка и текущий dev Supabase остаются неизменными.

## 1. Локальный preflight

Из корня проекта:

```powershell
.\scripts\preflight-beta.ps1
```

Не публиковать сборку, если lint, typecheck, unit tests или production build завершаются ошибкой.

## 2. Первый проект Vercel

Из корня проекта:

```powershell
npx vercel --prod
```

Войти в Vercel, создать новый проект и оставить Next.js build settings автоматически определёнными. Первый deploy может показать экран о неподключённом хранилище — это ожидаемо до добавления environment variables.

Сохранить постоянный production URL вида:

```text
https://<project-name>.vercel.app
```

В Vercel: Settings -> Functions -> выбрать Frankfurt как primary region, потому что beta Supabase создаётся в Frankfurt. После изменения региона выполнить redeploy.

## 3. Отдельный Supabase для beta

Создать новый Free project, например `vmeste-beta`, в Central EU (Frankfurt). Не использовать dev-проект как production backend.

Скопировать полный bootstrap:

```powershell
.\scripts\copy-closed-beta-sql.ps1
```

Supabase -> SQL Editor -> New query -> Ctrl+V -> Run.

Ожидаемый результат: Success.

Из Supabase -> Connect скопировать только:

- Project URL
- Publishable key (`sb_publishable_...`)

Никогда не помещать `service_role`, secret key или пароль БД в браузерные переменные приложения.

## 4. Google OAuth для beta

Для beta рекомендуется отдельный Web OAuth client в Google Auth Platform.

Google client:

- Application type: Web application
- Authorized JavaScript origin: `https://<project-name>.vercel.app`
- Authorized redirect URI: callback URL нового beta Supabase, вида `https://<project-ref>.supabase.co/auth/v1/callback`

Пока beta закрытая, Google Audience оставить в Testing и добавить email каждого тестировщика в Test users. Это ограничивает вход заранее выбранными Google-аккаунтами.

Client ID и Client Secret вставить только в Supabase -> Authentication -> Providers -> Google.

## 5. Supabase Auth URL Configuration

Supabase -> Authentication -> URL Configuration:

- Site URL: `https://<project-name>.vercel.app`
- Redirect URL: `https://<project-name>.vercel.app/**`

Для production предпочтителен точный production host. Preview URLs не нужны для первого закрытого теста.

## 6. Vercel environment variables

Vercel -> Project -> Settings -> Environment Variables -> Production:

```text
NEXT_PUBLIC_APP_NAME=Вместе
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_ALLOW_INDEXING=false
```

`NEXT_PUBLIC_APP_URL` в Vercel можно не задавать: приложение берёт текущий HTTPS origin из запроса. Это предотвращает ссылки-приглашения на localhost и корректно работает при будущем custom domain.

После изменения environment variables сделать Redeploy production deployment.

## 7. Smoke test на production URL

Проверить по порядку:

1. Лендинг открывается по HTTPS.
2. Google login работает.
3. Создаётся новая цель.
4. Добавление накопления обновляет прогресс.
5. Расход не меняет накопления.
6. CSV/XLSX показывает проверку операций до commit.
7. Создать приглашение и открыть его вторым разрешённым Google test user.
8. Второй пользователь добавляет тестовое накопление; первый видит Realtime без F5.
9. Второй пользователь не может архивировать цель или управлять участниками.
10. Экспорт данных скачивается из профиля.
11. `/privacy`, `/terms` и несуществующий URL отображаются корректно.
12. Проверить мобильную ширину около 390 px.

Только после этого production URL можно отправлять небольшой группе beta-тестировщиков.

## 8. Обновления beta

После изменения локального проекта:

```powershell
.\scripts\preflight-beta.ps1
npx vercel --prod
```

Vercel сохранит тот же production project/domain после первоначальной привязки папки проекта.

## Перед широким публичным запуском

Закрытая beta не равна публичному релизу. До широкого запуска остаются как минимум: удаление аккаунта и полный lifecycle данных, backup/restore drill, Apple OAuth, accessibility/security review, финальные юридические тексты и осознанное включение индексации.
