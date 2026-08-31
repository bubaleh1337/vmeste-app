# Git и релизы

## Первый commit

Из корня проекта на Windows 11:

```powershell
git init
git branch -M main
git status
git add -A
git commit -m "release: initial stable web version"
```

Перед первым commit убедись, что `.env.local` не показывается в `git status`.

## Обычный цикл после каждого успешного изменения

1. Проверить приложение локально.
2. Выполнить `./scripts/preflight-beta.ps1`.
3. Если всё прошло, выполнить:

```powershell
./scripts/release.ps1 -Message "feat: краткое описание изменения"
```

Скрипт повторно запускает preflight, показывает diff, добавляет изменения и создаёт commit. Push выполняется отдельно после проверки commit.

## После подключения GitHub

```powershell
git remote add origin <URL_PRIVATE_REPOSITORY>
git push -u origin main
```

После подключения этого репозитория к Vercel push в production-ветку может запускать production deployment автоматически. Для более безопасной работы новые функции лучше делать в отдельных ветках и проверять через Preview deployment до merge в `main`.
