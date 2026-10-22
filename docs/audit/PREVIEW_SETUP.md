# Конфигурация Preview-окружения Оукцион

Окружение: Vercel Preview → отдельный тестовый Supabase-проект.
Production-проект `ekxqnzhylckbdptrooms` для Preview **не используется**.

## 0. Состояние на 2026-10-22

| Пункт | Состояние |
|---|---|
| Ветка `feature/catalog-product-pages` в `Shvachkomax/Ouction` | SHA `b39b7a5` |
| Vercel-привязка | `Shvachkomax/Ouction` (`repoId 1320245903`), `productionBranch = main` |
| Push feature-ветки создаёт только Preview | подтверждено: новые деплои имеют `gitSource.ref = feature/catalog-product-pages`, production-деплои не добавились |
| Production-деплои | без изменений, 3 шт., SHA `193c588` / `5b13ac4` / `bc26a89` |
| Наследование production-значений в Preview | **устранено**: у 4 общих переменных target изменён на `production` |
| Тестовый Supabase-проект | создан: `netevqurorkipymtvmwb` «Oukcion Preview Test» (free, eu-central-1) |
| Схема в тестовой БД | применена, 30 проверок PASS, применение идемпотентно |
| Данные в тестовой БД | засеяны: 3 персоны, 4 товара (published / draft / moderation) |
| Runtime-проверки на PostgreSQL | 16 из 16 PASS |
| Браузерные проверки Preview | 32 из 32 PASS (три прогона подряд) |
| Проверки изоляции | 4 из 4 PASS |
| Preview-деплой | `dpl_Ei8uCRPkxhR7XxuNwA5F6gGruzYP` (SHA `b39b7a5b`) |

Подробности и ссылки: `docs/audit/PREVIEW_DEPLOYMENT_REPORT_2026-10-22.md`.

## 1. Тестовая база данных

| Параметр | Значение |
|---|---|
| Проект | `netevqurorkipymtvmwb` «Oukcion Preview Test» |
| Организация | `zfmmhueqnkyenyrlboic`, plan `free` |
| Регион | eu-central-1 |
| URL | `https://netevqurorkipymtvmwb.supabase.co` |
| Таблицы | `artists`, `physical_products`, `cabinet_login_attempts` |
| Бакет | `oukcion-media` (public, 8 МБ, jpeg/png/webp) |

Production-проект `ekxqnzhylckbdptrooms` не изменялся. Проекты «Точки
опоры» (`blwogrdezfhprdpdnxtn`, `eehyehlhiyztciaezaus`) не использовались.

### 1.1. Авторизация CLI

Токен Supabase CLI лежит в связке ключей macOS:

```bash
security find-generic-password -s "Supabase CLI" -a "supabase" -w
```

Если его нет, токен создаётся на
https://supabase.com/dashboard/account/tokens (роль `Read & Write
Management API`) и добавляется через `supabase login --token <PAT>`.
Токен не попадает в Git.

### 1.2. Схема

```bash
export SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
export PREVIEW_PROJECT_REF=netevqurorkipymtvmwb
node scripts/preview-db-setup.mjs --apply
```

Скрипт применяет четыре файла (`artists`, `physical-products`,
`media-storage`, `cabinet-login-attempts`) дважды подряд - повторное
применение не должно ломать схему, - и проверяет RLS, привилегии таблиц и
функций, `SECURITY DEFINER`, пустой `search_path`, квалификацию объектов и
настройки бакета. Production ref скрипт отвергает на входе.

`supabase/remove-demo-artists.sql` скриптом не применяется никогда.

### 1.3. Данные и runtime-проверки

```bash
source /tmp/oukcion-preview/env.sh   # PREVIEW_SUPABASE_URL, PREVIEW_*_KEY
node scripts/seed-preview-data.mjs
node scripts/preview-db-runtime-test.mjs
```

Seed использует только вымышленные данные: `test-anna-vetrova`,
`test-pavel-gusev`, `test-sonya-imer`; товары `test-sketch-42` (published),
`test-vase-blue` (published), `test-sketch-draft` (draft),
`test-vase-moderation` (moderation).

Runtime-тест проверяет через PostgREST, что `anon` читает только
опубликованное, не пишет, не видит таблицу лимитера и не может вызвать
его RPC, что `service_role` может, что 8 параллельных первых попыток
считаются точно и создают одну строку, что порог блокирует, а сброс
удаляет строку.

## 2. Переменные Preview

В Vercel набор переменных разделён по target:

| Переменная | production | preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | прежнее значение | `https://netevqurorkipymtvmwb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | прежнее значение | publishable-ключ тестового проекта |
| `SUPABASE_SERVICE_ROLE_KEY` | прежнее значение | service_role тестового проекта |
| `CABINET_ACCESS_CODE` | прежнее значение | тестовый код кабинета |

Значения production-переменных не менялись. Код Preview лежит в
`/tmp/oukcion-preview/cabinet_code.txt` и в Vercel (sensitive), в Git его
нет.

### 2.1. Замечание по ключам

Management API возвращает новый тип ключа `sb_secret_…` замаскированным
(середина значения заменена точками) - использовать его нельзя, PostgREST
отвечает «Invalid API key». В Preview применяется legacy-ключ
`service_role` (JWT): он возвращается полностью и работает и в PostgREST,
и в `supabase-js`.

## 3. Ограничения доступа

Preview защищён Vercel: `ssoProtection = all_except_custom_domains`.
Открыть его можно только после входа в Vercel - по прямой ссылке без
авторизации вернётся «Protected by Vercel Authentication».

Для автоматических проверок создан bypass-токен защиты деплоя
(`automation-bypass`): запросы идут с заголовком
`x-vercel-protection-bypass`. Публичность деплоя он не меняет. Удаляется в
Vercel → Project `oukcion` → Settings → Deployment Protection → Protection
Bypass for Automation.

## 4. Проверки Preview

```bash
export PREVIEW_URL=https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app
export VERCEL_BYPASS=<bypass-токен из Vercel>
export PREVIEW_DB_HOST=netevqurorkipymtvmwb.supabase.co
export CABINET_CODE=<тестовый код кабинета>
node scripts/preview-browser-check.mjs
node scripts/preview-isolation-check.mjs
```

`preview-browser-check.mjs` работает в двух режимах: без БД страницы должны
падать с явной ошибкой, а кабинет - отклонять вход; с БД каталог должен
показывать тестовые данные, черновик и модерация - не показывать, кабинет -
открываться по верному коду.

`preview-isolation-check.mjs` сканирует HTML и все JS-чанки деплоя на
production-хост Supabase и на утечку тестового адреса БД.

## 5. Что проверяется на Preview

- каталог: категории, поиск, сортировки, фильтры;
- карточка товара: цена, остаток, состояние, персона, описание,
  происхождение, доставка;
- карточка персоны: данные и список товаров;
- 404 для неизвестных slug и для черновиков;
- отказ БД и восстановление после него;
- мобильная вёрстка без горизонтального переполнения;
- вход в кабинет, создание и удаление карточек;
- RLS: черновики и модерация не видны анонимному клиенту;
- общий лимит входа: при недоступности общей БД вход отклоняется целиком
  (fail closed), обходного in-memory счётчика нет.

## 6. Откат

Preview-деплой не влияет на production. Откат Preview = удаление тестового
проекта Supabase и/или Preview-деплоя Vercel. Production-деплой не
трогается.

## 7. Что проверено, а что осталось

### Проверено

- все маршруты каталога, фильтры, поиск, сортировки, кириллические URL;
- 404 для неизвестных slug и для черновиков;
- отказ БД и восстановление после него на всех трёх страницах;
- мобильная вёрстка без горизонтального переполнения;
- русская страница 404;
- RLS на настоящем PostgreSQL: черновики скрыты, запись и RPC лимитера
  закрыты для клиентских ролей;
- конкурентность лимитера входа: параллельные попытки считаются точно;
- изоляция Preview от production: production-хост не встречается в
  отдаваемых файлах.

### Не проверено

- загрузка медиа в кабинете на Preview (права и бакет проверены на уровне
  БД и схемы, но не вручную);
- реальные медиа-URL - в тестовых данных фотографий нет;
- поведение под нагрузкой и кэширование страниц на реальных данных.
