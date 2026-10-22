# Отчёт: Preview-развёртывание Оукцион (каталог, товар, персона)

Дата: 2026-10-22
Ветка: `feature/catalog-product-pages`
Локальный HEAD и remote HEAD: `b39b7a5`
Проект Vercel: `maxim-shvachko-s-projects/oukcion` (`prj_JLR1FscDMoq1OgvSCqT0aWnVm7oK`)

## 1. Итог

| Пункт | Состояние |
|---|---|
| Preview-деплой | `dpl_Ei8uCRPkxhR7XxuNwA5F6gGruzYP`, SHA `b39b7a5b`, READY |
| Preview URL | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app` |
| Доступ к Preview | только после входа в Vercel (`ssoProtection = all_except_custom_domains`) |
| Тестовая Supabase | создана: `netevqurorkipymtvmwb` «Oukcion Preview Test», free, eu-central-1 |
| Схема | применена и проверена (30 проверок), 24 из 24 PASS |
| Данные | засеяны вымышленные персоны и товары (3 + 4) |
| Runtime-проверки RLS | 16 из 16 PASS на настоящем PostgreSQL |
| Браузерные проверки Preview | 32 из 32 PASS, три прогона подряд |
| Изоляция от production | подтверждена: production-хост не встречается ни в HTML, ни в 8 JS-чанках |
| Production | не изменён (данные, значения переменных, деплои) |

## 2. Ссылки для ручной проверки

| Что | Ссылка |
|---|---|
| Главная | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/` |
| Каталог | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/catalog` |
| Товар (опубликован) | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/products/test-sketch-42` |
| Товар (вторая цена) | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/products/test-vase-blue` |
| Персона | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/artists/test-anna-vetrova` |
| Кабинет оператора | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/cabinet/artists` |
| Страница 404 | `https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app/no-such-route` |

Все ссылки требуют входа в Vercel.

**Код доступа в кабинет (только Preview):** `2glD5p9oBgoNqXwdFpLO`

Код задан переменной `CABINET_ACCESS_CODE` с target `preview` в Vercel и
действует только в Preview-окружении: production использует другой код.
Значение также лежит локально в `/tmp/oukcion-preview/cabinet_code.txt` и в
связке ключей Vercel (sensitive). В Git кода нет.

### Что можно проверить вручную

1. Каталог: видны персоны «Анна Ветрова (тест)», «Павел Гусев (тест)»,
   «Соня Имер (тест)» и опубликованные товары «Скетч №42 (тест)»
   (15 000 ₽) и «Ваза "Синяя" (тест)» (24 000 ₽). Черновик и товар на
   модерации не видны.
2. Карточка товара: название, цена, остаток, состояние, персона, описание,
   происхождение, условия доставки.
3. Карточка персоны: имя, описание, список её товаров.
4. Несуществующий slug → 404 «Такой страницы нет».
5. Кабинет: неверный код → «Неверный код доступа»; верный код → список
   карточек, форма создания персоны и товара.
6. Мобильный экран (390×844): без горизонтального переполнения.

## 3. Тестовая база данных

| Параметр | Значение |
|---|---|
| Проект | `netevqurorkipymtvmwb` «Oukcion Preview Test» |
| Организация | `zfmmhueqnkyenyrlboic` «Shvachkomax's Org», plan `free` |
| Регион | eu-central-1 |
| URL | `https://netevqurorkipymtvmwb.supabase.co` |
| Таблицы | `artists`, `physical_products`, `cabinet_login_attempts` |
| Бакет | `oukcion-media` (public, 8 МБ, jpeg/png/webp) |

Production-проект `ekxqnzhylckbdptrooms` не изменялся. Проекты «Точки
опоры» (`blwogrdezfhprdpdnxtn`, `eehyehlhiyztciaezaus`) не использовались и
не затрагивались.

### Засеянные данные (полностью вымышленные)

- Персоны: `test-anna-vetrova`, `test-pavel-gusev`, `test-sonya-imer`.
- Товары: `test-sketch-42` (published), `test-vase-blue` (published),
  `test-sketch-draft` (draft), `test-vase-moderation` (moderation).

## 4. Что проверено на настоящем PostgreSQL

`node scripts/preview-db-runtime-test.mjs` - 16 проверок, все PASS:

| Проверка | Результат |
|---|---|
| anon читает опубликованные товары | PASS (2 строки) |
| anon не читает черновики | PASS (0 строк) |
| anon не читает товары на модерации | PASS (0 строк) |
| anon не может вставить персону | PASS (401) |
| anon не может изменить товар | PASS (401) |
| anon не может удалить товар | PASS (401) |
| anon не видит таблицу лимитера | PASS (401) |
| anon не вызывает RPC лимитера | PASS (401) |
| anon не вызывает сброс лимитера | PASS (401) |
| service_role видит таблицу лимитера | PASS (200) |
| 8 параллельных вызовов лимитера успешны | PASS (0 ошибок) |
| 8 параллельных первых попыток посчитаны точно | PASS (8 из 8) |
| 8 параллельных первых попыток создали одну строку | PASS (1 строка) |
| лимит блокирует запрос, достигший порога | PASS (`locked: true`) |
| заблокированная строка сохраняет точный счётчик | PASS (`attempt_count: 10`) |
| сброс лимитера удаляет строку | PASS (0 строк) |

Проверка конкуренции подтверждает, что атомарный `insert ... on conflict do
update` действительно считает параллельные попытки: все 8 запросов, идущих
одновременно, учтены, а не потеряны.

## 5. Проверки схемы

`node scripts/preview-db-setup.mjs --apply` - 30 проверок, все PASS:

- таблицы `artists`, `physical_products`, `cabinet_login_attempts` созданы,
  RLS включён;
- `anon` и `authenticated` имеют на каталоговых таблицах только `SELECT`;
- на `cabinet_login_attempts` у клиентских ролей нет ни одного гранта;
- обе функции лимитера: `SECURITY DEFINER`, `search_path = ""`,
  `anon`/`authenticated` не могут `EXECUTE`, `service_role` может;
- все обращения к таблицам в функциях qualify схемой (`public.`);
- бакет `oukcion-media` существует, публичный, с ограничениями по размеру и
  MIME; политики чтения для клиентов и записи только для `service_role`.

Схема применяется дважды подряд без ошибок - применение идемпотентно.

### Найденный и исправленный дефект привилегий

Supabase по умолчанию выдаёт `anon` и `authenticated` все права на таблицы
публичной схемы. RLS закрывает чтение и запись, но `TRUNCATE` и `REFERENCES`
под RLS не попадают - таблицу мог обрезать анонимный клиент. В
`supabase/artists.sql` и `supabase/physical-products.sql` добавлен явный
`revoke all ... from anon, authenticated` перед `grant select`. Все записи в
приложении идут через `service_role`, поэтому поведение кабинета не
изменилось.

## 6. Браузерные проверки Preview

`node scripts/preview-browser-check.mjs` - 32 проверки, все PASS (три
прогона подряд):

- главная, каталог, товар, персона, 404, кабинет - HTTP 200 и русский
  интерфейс;
- каталог показывает тестовые данные, черновик и модерация скрыты;
- карточка товара показывает название, цену, персону, остаток и состояние;
- неизвестные slug товара и персоны дают 404;
- 404 на русском: «Такой страницы нет»;
- кабинет: неверный код отклонён с сообщением «Неверный код доступа»,
  общий лимитер доступен, верный код открывает кабинет со списком карточек;
- мобильные `/`, `/catalog`, `/products/…`, `/artists/…`, `/cabinet/artists` -
  0 px горизонтального переполнения;
- браузер не обращается к Supabase напрямую (каталог читается на сервере);
- ошибок в консоли браузера нет.

`node scripts/preview-isolation-check.mjs` - 4 проверки, все PASS:

- production-хост `ekxqnzhylckbdptrooms.supabase.co` не встречается ни в
  HTML, ни в 8 JS-чанках;
- тестовый адрес БД не утёк в клиентский бандл;
- каталог отдаёт данные тестовой БД (помечены как тестовые);
- в каталоге нет сообщений об ошибке БД.

## 7. Переменные Vercel

| Переменная | production | preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | прежнее значение | `https://netevqurorkipymtvmwb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | прежнее значение | publishable-ключ тестового проекта |
| `SUPABASE_SERVICE_ROLE_KEY` | прежнее значение | service_role тестового проекта |
| `CABINET_ACCESS_CODE` | прежнее значение | `2glD5p9oBgoNqXwdFpLO` |

Значения production-переменных не менялись, добавлены только отдельные
переменные с target `preview`.

### Замечание по ключам

Management API возвращает новый тип ключа `sb_secret_…` замаскированным
(середина значения - точки), поэтому использовать его нельзя: PostgREST
отвечает «Invalid API key». В Preview применяется legacy-ключ
`service_role` (JWT), который возвращается полностью и работает и в
PostgREST, и в `supabase-js`.

## 8. Production не изменён

- Production-данные: не читал и не писал.
- Значения переменных: прежние; у общих переменных изменён только список
  target, добавлены отдельные переменные для `preview`.
- Production-деплой: не менялся. По-прежнему 3 деплоя из `main`
  (`193c588f`, `5b13ac42`, `bc26a89f`). Новые деплои созданы только для
  feature-ветки.
- Production-сайт отвечает 200, по-прежнему читает
  `https://ekxqnzhylckbdptrooms.supabase.co`; `/catalog` на production - 404
  (каталог есть только в feature-ветке).
- Merge в `main`, production-деплой и продвижение Preview в production не
  выполнялись.

## 9. Ограничения

- Тестовые данные вымышленные: реальных лотов, персон и фотографий нет.
- Загрузка медиа через кабинет на Preview не проверялась вручную, хотя
  права и бакет проверены на уровне БД и схемы.
- Для автоматической проверки защищённого Preview создан bypass-токен
  защиты деплоя Vercel (`automation-bypass`). Публичность деплоя он не
  меняет. Удаляется в Vercel → Project `oukcion` → Settings → Deployment
  Protection → Protection Bypass for Automation.
- Проект Supabase создан на бесплатном тарифе; при его удалении нужно
  также удалить 4 переменные с target `preview`.

## 10. Как повторить проверку

```bash
# 1. схема и проверки (нужен PAT в keychain)
export SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
export PREVIEW_PROJECT_REF=netevqurorkipymtvmwb
node scripts/preview-db-setup.mjs --apply

# 2. данные и runtime-проверки
source /tmp/oukcion-preview/env.sh   # PREVIEW_SUPABASE_URL, PREVIEW_*_KEY
node scripts/seed-preview-data.mjs
node scripts/preview-db-runtime-test.mjs

# 3. браузерные проверки и изоляция
export PREVIEW_URL=https://oukcion-5qh9ctjd7-maxim-shvachko-s-projects.vercel.app
export VERCEL_BYPASS=<bypass-токен из Vercel>
export PREVIEW_DB_HOST=netevqurorkipymtvmwb.supabase.co
export CABINET_CODE=2glD5p9oBgoNqXwdFpLO
node scripts/preview-browser-check.mjs
node scripts/preview-isolation-check.mjs
```
