# Конфигурация Preview-окружения Оукцион

Окружение: Vercel Preview → отдельный тестовый Supabase-проект.
Production-проект `ekxqnzhylckbdptrooms` для Preview **не используется**.

## 0. Что уже сделано (проверено)

| Пункт | Состояние |
|---|---|
| Ветка `feature/catalog-product-pages` запушена в `Shvachkomax/Ouction` | сделано, SHA `d7bc66b` |
| Vercel-привязка | `Shvachkomax/Ouction` (`repoId 1320245903`), `productionBranch = main` |
| Push feature-ветки создаёт только Preview | подтверждено: авто-деплой `dpl_DV7uLLtD…` имел `target=preview`, production-деплои не добавились |
| Production-деплои | без изменений, 3 шт., SHA `193c588` / `5b13ac4` / `bc26a89` |
| Наследование production-значений в Preview | **устранено**: у всех 4 общих переменных target изменён на `production` |
| Preview, собранный с production-значениями | удалён (`state=DELETED`) |
| Лимитер входа в кабинете | закрыт на fail-closed, RPC-функции отозваны у `PUBLIC` (см. п. 5) |
| Скрипты проверки | `scripts/preview-db-setup.mjs`, `scripts/seed-preview-data.mjs`, `scripts/preview-db-runtime-test.mjs` |

## 1. Тестовая база данных

### 1.1. Единственное действие владельца

Токен Supabase CLI в связке ключей отозван, поэтому `supabase projects list`
возвращает `Invalid access token`. Нужен один вход:

1. Открыть https://supabase.com/dashboard/account/tokens и создать токен
   (роль ` Management API` / `Read & Write Management API`).
2. Выполнить в своей консоли:

```bash
supabase login --token <СОЗДАННЫЙ_ТОКЕН>
```

Токен не присылать в чат и не класть в Git. CLI сохранит его в связке ключей
(`Supabase CLI` / `supabase`), после чего `supabase projects list` заработает.

Альтернатива: в Chrome уже открыт таб «Authorize CLI | Supabase» - если
нажать Authorize, CLI сам сохранит токен.

### 1.2. Проверка проектов и организаций

```bash
supabase projects list
supabase orgs list
```

Production-проект `ekxqnzhylckbdptrooms` в списке не трогаем.

### 1.3. Создание тестового проекта

Если в организации уже есть свободный проект Oukcion для Preview - используем
его. Если нет - создаём отдельный:

```bash
supabase projects create oukcion-preview-test \
  --org-id <ORG_ID> \
  --db-password <ПАРОЛЬ_БД> \
  --region <REGION> \
  --size nano
```

Перед созданием: указать организацию, проверить её тариф и лимит проектов
(`supabase orgs list`). Бесплатный проект не создаёт платных ресурсов.
Платные ресурсы без отдельного согласования не создаются.

### 1.4. Применение схемы

Каталога `supabase/migrations/` и `supabase/config.toml` в репозитории нет,
поэтому `supabase db push` **ничего не применит**. Схема - это standalone
SQL-файлы, применяются в таком порядке:

1. `supabase/artists.sql` - таблица `artists` + RLS + публичная политика чтения
2. `supabase/physical-products.sql` - таблица `physical_products` + RLS + политика
   чтения только `status = 'published'` (FK на `artists(slug)` - порядок важен)
3. `supabase/media-storage.sql` - bucket `oukcion-media` (public) + политики
   чтения для клиентов и записи только через `service_role`
4. `supabase/cabinet-login-attempts.sql` - таблица лимитера входа + функции

`supabase/remove-demo-artists.sql` на тестовой базе не применять - там нет
демо-персон.

Готовый скрипт (применяет схему дважды - проверка идемпотентности - и потом
проверяет права):

```bash
SUPABASE_ACCESS_TOKEN=<PAT> PREVIEW_PROJECT_REF=<REF> \
  node scripts/preview-db-setup.mjs --apply
```

## 2. Переменные Preview

Сейчас у всех четырёх общих переменных target = `production` (изменение
выполнено, значения не тронуты). Поэтому ни один Preview сейчас не наследует
production-значения.

Тестовые значения добавляются отдельными записями с target = `preview`:

| Переменная | Значение | Обязательна |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | да |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key тестового проекта | да |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key тестового проекта | да |
| `CABINET_ACCESS_CODE` | отдельный тестовый код доступа в кабинет | да |

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL preview --sensitive --value "https://<REF>.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY preview --sensitive --value "<PUBLISHABLE_KEY>"
vercel env add SUPABASE_SERVICE_ROLE_KEY preview --sensitive --value "<SERVICE_ROLE_KEY>"
vercel env add CABINET_ACCESS_CODE preview --sensitive --value "<ТЕСТОВЫЙ_КОД>"
```

Production-окружение не менять.

## 3. Ограничения доступа

- `SUPABASE_SERVICE_ROLE_KEY` используется только в `lib/supabase-admin.ts`
  (кабинет оператора, загрузка файлов). Публичное чтение каталога идёт
  через anon-ключ - см. `lib/supabase.ts`.
- `CABINET_ACCESS_CODE` в Preview задаётся отдельный. Владелец получает его из
  Vercel (Settings → Environment Variables → Preview → Reveal) либо из своего
  менеджера паролей; в Git он не попадает.
- Тестовая база не должна содержать реальных персональных данных.

## 4. Чек-лист перед деплоем Preview

- [ ] `supabase projects list` показывает отдельный preview-проект
- [ ] `node scripts/preview-db-setup.mjs --apply` проходит все проверки
- [ ] `node scripts/seed-preview-data.mjs` наполняет базу вымышленными данными
- [ ] `node scripts/preview-db-runtime-test.mjs` проходит все проверки
- [ ] 4 переменные заданы с target = `preview`
- [ ] Эффективный URL Preview относится к тестовому проекту
      (проверяется по `https://<DEPLOYMENT_URL>/` → исходный код страницы)
- [ ] `npm run lint && npm run typecheck && npm run build` проходят локально

## 5. Что проверяется на Preview

1. Главная → каталог → товар → персона работают на реальном Supabase.
2. RLS действительно скрывает черновики (это нельзя проверить на mock).
3. Запись в кабинете оператора работает и не пишет в production.
4. Rate-limit входа работает на настоящем PostgreSQL (конкурентные попытки).
5. Загрузка медиа в bucket работает.

### 5.1. Что изменено в лимитере входа (обязательно к применению)

`supabase/cabinet-login-attempts.sql` исправлен по результатам проверки кода:

- Счётчик считается одним атомарным `insert ... on conflict do update` с
  блокировкой строки. Раньше `on conflict do nothing` терял конкурентные
  первые попытки, и счётчик не совпадал с числом запросов.
- Раньше `return query` не прерывал функцию, поэтому после ветки «первая
  попытка» выполнение продолжалось и падало на `NOT NULL` - первая попытка
  по новому ключу всегда завершалась ошибкой.
- `REVOKE ... FROM anon/authenticated` не отменяет `PUBLIC`-грант, который
  Postgres выдаёт на `CREATE FUNCTION` по умолчанию. Клиент мог вызвать
  `reset_cabinet_login_rate_limit` и снять свою блокировку. Добавлен
  `revoke ... from public`.
- `search_path = public` заменён на `search_path = ''`, все объекты
  квалифицированы (`public.cabinet_login_attempts`).

В приложении in-memory счётчик удалён: serverless-инстансы Vercel его не
разделяют, поэтому это не общая защита. Если общий лимитер недоступен, вход
отклоняется с сообщением «Вход временно недоступен: не работает защита от
подбора кода» (`?error=rate-limiter-unavailable`).

## 6. Откат

Preview-деплой не влияет на production. Откат Preview = удаление тестового
проекта Supabase и/или Preview-деплоя Vercel. Production-деплой не трогается.

## 7. Что уже проверено, а что осталось

### Проверено (локально, изолированный mock)

- Все маршруты каталога, фильтры, поиск, сортировки, кириллические URL.
- 404 для неизвестного slug и для черновиков.
- Отказ БД и восстановление после него на всех трёх страницах.
- Мобильная вёрстка без горизонтального переполнения.
- Русская страница 404.

### Не проверено (требует настоящего PostgreSQL)

- RLS-политики: скрывают ли черновики запросы anon-ключом.
  **Mock-фильтрация в коде проверкой RLS не является.**
- Атомарность и конкурентная корректность rate-limit входа
  (`cabinet_login_attempts`) на настоящем PostgreSQL.
- Поведение `insert ... on conflict` при параллельных записях в кабинет.

### Не проверено (требует реального Supabase)

- Реальные медиа-URL из бакета `oukcion-media`.
- Запись через server actions с `service_role`.
- Загрузка файлов в storage.
- Кэширование страниц с `revalidate` на реальных данных.

## 8. Состояние окружения (на 2026-10-22, SHA `fe8877e`)

| Окружение | Привязка | Состояние |
|---|---|---|
| Production | `Shvachkomax/Ouction:main` → Vercel `oukcion` | Работает, данные видны, деплой не менялся |
| Preview | Тот же Vercel-проект, ветка `feature/catalog-product-pages` | Деплой `dpl_661B7SmmtrteSHvBfmiDjwy1t5sL` (SHA `fe8877e`) собран **без** Supabase-переменных |
| Переменные Vercel | 4 общих, target = `production` | Значения прежние, Preview их не наследует |
| Защита деплоя | `ssoProtection = all_except_custom_domains` | Preview открыт только после входа в Vercel |
| Supabase CLI | `Invalid access token` | Требуется `supabase login --token <PAT>` |

### 8.1. Проверено на действующем Preview

`node scripts/preview-browser-check.mjs` - 17 проверок, все пройдены:

- главная, каталог, кабинет - HTTP 200, русский интерфейс;
- главная и мобильные `/`, `/catalog`, `/cabinet/artists` - без горизонтального
  переполнения (0 px);
- каталог показывает «Не удалось загрузить каталог», а не пустой список;
- страница товара без БД - HTTP 200 с ошибкой, а не 404 (ошибка БД не
  маскируется под «товара нет»);
- неизвестный маршрут - HTTP 404 с русской страницей «Такой страницы нет»;
- вход в кабинет без общего лимитера отклонён с сообщением
  «не работает защита от подбора кода» - ослабленный обход не включается;
- Preview не обращается ни к одному Supabase, в том числе к production;
- ошибок в консоли браузера нет.

Ожидаемо, что до подключения тестовой БД каталог показывает состояние
ошибки: переменные Preview намеренно не содержат production-значений.

### 8.2. Production не изменён

Production-данные, значения переменных и деплой не менялись:

- 3 production-деплоя остались прежними (`193c588f`, `5b13ac42`, `bc26a89f`);
- у 4 общих переменных изменён только список target (`preview` убран,
  `production` оставлен), значения не тронуты;
- Preview-деплои, собранные до снятия наследования и устаревшие по SHA
  (`dpl_DV7uLLtD…`, `dpl_AxUarVXJDWS2bCHJiBvUqWkkYqe4`), удалены - остался
  один актуальный `dpl_661B7SmmtrteSHvBfmiDjwy1t5sL`;
- production-сайт отвечает 200 и по-прежнему читает
  `https://ekxqnzhylckbdptrooms.supabase.co`.

### 8.3. Изменение настроек Vercel, о котором нужно знать

Для автоматической проверки защищённого Preview командой `vercel curl`
создан **bypass-токен защиты деплоя** (`automation-bypass`). Он позволяет
обращаться к деплоям проекта из автоматизации по HTTP-заголовку
`x-vercel-protection-bypass` и не открывает деплой публично. Токен хранится
в Vercel как sensitive-переменная и не попадает в Git.

Если владелец хочет удалить токен: Vercel → Project `oukcion` →
Settings → Deployment Protection → Protection Bypass for Automation.
