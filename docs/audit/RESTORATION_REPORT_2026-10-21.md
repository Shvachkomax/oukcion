# Отчёт по завершению working/restore-foundation

Дата: 2026-10-21 | Ветка: working/restore-foundation | От продакшен-источника: 193c588 (Shvachkomax/oukcion, public)

## 1) Проверка настоящего Supabase-проекта Oukcion

| Пункт | Статус | Примечание |
|---|---|---|
| Подключение (реальный URL/ключи прод-БД) | НЕ ПРОВЕРЕНО | Vercel env помечены Sensitive ([SENSITIVE]), `vercel env pull` не раскрывает значения. `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` недоступны. |
| Схема (artists, physical_products, RLS) | ПРОВЕРЕНО по исходнику | `supabase/*.sql` из production-source подтверждают схему/RLS. Реальное содержимое таблиц не просмотрено. |
| Политики RLS | ПРОВЕРЕНО по исходнику | `artists` публичное SELECT для anon/authenticated. `physical_products` SELECT только `status='published'` для anon/authenticated. INSERT/UPDATE/DELETE только через service_role (политик нет) — корректно. |
| Хранилище (oukcion-media) | ПРОВЕРЕНО по коду | bucket `oukcion-media`, public, 8MB, jpeg/png/webp; загрузка через service_role. Реальная конфигурация bucket/policies не проверена. |
| Проекты Tochka-Opori (eehyehlhiyztciaezaus/blwogrdezfhprdpdnxtn) | НЕ ИСПОЛЬЗУЮТСЯ | Отличная структура (74 клинические таблицы), таблиц artists/physical_products нет. |

**Блокер:** нет доступа к чтению Vercel env, нет валидного Supabase CLI токена, нет доступа к dashboard Supabase проекта Oukcion. 
**Действия владельца:** предоставить `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, доступ к Supabase проекту Oukcion (dashboard или `supabase login`), либо выгрузить env в безопасном канале. Локально БД не изменялась.

## 2) Ограничение входа в кабинет

### Реализация
- **Двойной бэкенд:** `dbCheck()` через `supabaseAdmin` по таблице `cabinet_login_attempts` + fallback `memoryCheck()` при отсутствии таблицы/ошибке/отсутствии supabaseAdmin.
- **IP-клиент:** `getClientKey()` из `x-forwarded-for` (первый), `x-real-ip`, `x-vercel-forwarded-for` (первый), иначе `ip:unknown`. На Vercel доверенные заголовки присутствуют, но заголовки могут подменяться клиентом вне доверенного прокси — использование первого IP из `x-forwarded-for` уязвимо к спуфингу; в текущей реализации нет списка доверенных прокси. **Требует доработки для production**.
- **Атомарность:** в текущей реализации нет транзакции/`UPDATE ... WHERE ... RETURNING` с условием, нет advisory lock. Увеличение счётчика выполняется чтением строки + последующим обновлением (read-modify-write) — при параллельных запросах возможна гонка. **Не атомарно.**
- **Межэкземплярность:** через таблицу `cabinet_login_attempts` — **сохраняется между экземплярами** при наличии таблицы и работающем Supabase. In-memory — **только в рамках одного инстанса**.
- **RLS таблицы:** `supabase/cabinet-login-attempts.sql` создаёт таблицу с `REVOKE ALL ON TABLE public.cabinet_login_attempts FROM anon, authenticated;` и не создаёт политик — доступ только service_role. **Анонимный клиент не должен иметь доступа.** Требуется применить миграцию и проверить.
- **Сбой/отсутствие таблицы:** при ошибке `dbCheck()` возвращает `null` и используется in-memory fallback. Fallback **не логирует явно** переключение; защита ослабевает (per-instance), но не полностью отключается. **Не превращается в явный обход — используется fallback, но он слабее.** Считаю неприемлемым называть in-memory полноценной production-защитой.
- **Сброс при успехе:** `resetLoginRateLimit()` удаляет строку из БД и очищает in-memory.

### Проверенные сценарии (на mock + dev)
- Неверный код: отклонён, cookie не выдан.
- Верный код после неудач: разрешён (счётчик сброшен).
- Лимит по DB-пути: блокировка на попытке #10, правильный код блокируется при активной блокировке.
- Лимит по memory-fallback (таблица скрыта в mock): блокировка на попытке #10.
- Успешный вход сбрасывает счётчик.

**Миграция `supabase/cabinet-login-attempts.sql` НЕ применялась к production.**

## 3) Ссылка «Стать продавцом» → «Вход для оператора»
В `app/page.tsx:246-249` заменена. Больше нет упоминания «Стать продавцом».

## 4) Отрицательные тесты записи без доступа
Проверено по build-чаку (`.next/server/chunks/ssr/[root-of-the-server]__1nvpps7g_p2aq._.js`): все серверные действия зарегистрированы, содержат редиректы `error=unauthorized`. В исходнике `actions.ts`:
- `saveArtist`/`savePhysicalProduct`: первый `if (!allowed) redirect("/cabinet/artists?error=unauthorized")`, затем повторная проверка + возврат ошибки при отсутствии cookie, проверка `supabaseAdmin`.
- `deleteArtist`/`deletePhysicalProduct`: редиректы при отсутствии доступа/конфига/ошибках, блокировка удаления артиста при наличии товаров.

Прямой вызов без cookie → редирект на `/cabinet/artists?error=unauthorized`. Данные не изменяются (редирект до операций с БД).

## 5) Резервные копии, .env, секреты
- Резервные копии сохранены в `/Users/macintosh/Documents/GitHub/Ouction/_backups/2026-10-21-restore-foundation/` (bundle'ы, worktree копии, vercel link).
- `.env.local` игнорируется `.gitignore` (`.env*.local`). `.env.example` содержит только имена переменных.
- Секреты не найдены в отслеживаемых файлах. В untracked есть `.env.local` (mock-значения) и `.vercel.local/` — не будут добавлены.
- Диагностические артефакты в `docs/` — уместны для аудита, но при коммите требуется оценка. Backups вне репозитория.

## 6) Git статус, diff, тесты

### Git статус
```
On branch working/restore-foundation
Your branch is up to date with 'production-source/main'.

Changes not staged for commit:
	modified:   app/cabinet/artists/actions.ts
	modified:   app/globals.css
	modified:   app/page.tsx
	modified:   lib/artists.ts
	modified:   next-env.d.ts
	modified:   package-lock.json
	modified:   package.json
	modified:   tsconfig.json

Untracked files:
	.github/
	.vercel.local/
	AGENTS.md
	docs/
	eslint.config.mjs
	supabase/cabinet-login-attempts.sql
	tsconfig.tsbuildinfo
```

### Diff --stat
```
 app/cabinet/artists/actions.ts |  200 +-
 app/globals.css                |   80 +-
 app/page.tsx                   |   81 +-
 lib/artists.ts                 |   89 +-
 next-env.d.ts                  |    3 +-
 package-lock.json              | 4744 +++++++++++++++++++++++++++++++++++++---
 package.json                   |   14 +-
 tsconfig.json                  |    3 +-
 8 files changed, 4786 insertions(+), 428 deletions(-)
```

### Целевые тесты
| Тест | Результат |
|---|---|
| `npm run lint` | PASS (ESLint flat config, 0 ошибок) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS (Next 16.4.2) |
| `npm audit` | PASS (0 vulnerabilities) |
| Cabinet regression (login/wrong code/cookie/unauth) | PASS (4/4) |
| Rate limit DB path (10 attempts → block) | PASS |
| Rate limit memory fallback (table hidden) | PASS |
| Rate limit reset on success | PASS |
| Cabinet write path (create artist) | PASS |
| Homepage demo labels visible | PASS (8 occurrences) |
| No horizontal scroll desktop/mobile | PASS |

### Подтверждённые и непроверенные пункты
**Подтверждено:** lint/typecheck/build/audit зелёные, guards в server actions, rate-limit с DB+fallback, демо-лейблы, замена ссылки, тесты кабинета, скриншоты, бэкапы.
**Не подтверждено:** реальная схема/RLS/policies/storage прод-BD, содержимое prod-таблиц, применимость миграции в prod, атомарность rate-limit при высокой конкуренции, список доверенных прокси для IP.

### Точные условия готовности к Preview
1. **Код:** lint+typecheck+build проходят, нет секретов в изменениях. ✅
2. **Supabase Oukcion:** получить валидный доступ к проекту/ключи, применить `supabase/cabinet-login-attempts.sql` (или эквивалент), проверить RLS `cabinet_login_attempts` (только service_role). ⚠️ БЛОКЕР
3. **IP/trust proxy:** определить доверенный список прокси для `getClientKey()` (избежать спуфинга `x-forwarded-for`). ⚠️ ТРЕБУЕТ РЕШЕНИЯ
4. **Rate-limit атомарность:** рассмотреть `UPDATE ... WHERE attempt_count < N AND (locked_until IS NULL OR locked_until < now) RETURNING ...` с блокировкой/функцией в Postgres для атомарности. ⚠️ РЕКОМЕНДУЕТСЯ
5. **Env Vercel Preview:** настроить `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CABINET_ACCESS_CODE`. ⚠️ ТРЕБУЕТ ВЛАДЕЛЬЦА
6. **Тест на Preview:** прогнать негативные тесты server actions без cookie, rate-limit, cabinet write/read.
7. **Не менять:** production, не делать push/deploy до выполнения пп.2-5.

**Статус:** готов к Preview **только после** восстановления доступа к прод-Supabase и решения по пп.3-4. Push/deploy не выполнялись.
