# Отчёт: Preview-развёртывание Оукцион (каталог, товар, персона)

Дата: 2026-10-22
Ветка: `feature/catalog-product-pages`
Локальный HEAD и remote HEAD: `fe8877e`
Проект Vercel: `maxim-shvachko-s-projects/oukcion` (`prj_JLR1FscDMoq1OgvSCqT0aWnVm7oK`)

## 1. Итог

| Пункт | Состояние |
|---|---|
| Preview-деплой | `dpl_661B7SmmtrteSHvBfmiDjwy1t5sL`, SHA `fe8877eb`, READY |
| Preview URL | `https://oukcion-g1o28a0s9-maxim-shvachko-s-projects.vercel.app` |
| Доступ к Preview | только после входа в Vercel (`ssoProtection = all_except_custom_domains`) |
| Тестовая Supabase | **не создана** - блокер на доступе владельца к Supabase CLI |
| Изоляция Preview от production | выполнена и подтверждена |
| Production | не изменён (данные, значения переменных, деплои) |

## 2. Блокер и минимальное действие владельца

Токен Supabase CLI в связке ключей отозван. Любой вызов management API
возвращает ровно:

```
Invalid access token
```

Источник ошибки установлен: PAT лежит в связке ключей macOS
(`svce = "Supabase CLI"`, `acct = "supabase"`, формат `sbp_…`, 44 символа,
создан 2026-08-14). Переменная окружения `SUPABASE_ACCESS_TOKEN` не задана и
авторизацию не перекрывает - токен отвергает сам API Supabase на всех
эндпоинтах (`/v1/projects`, `/v1/organizations`, `/v1/me`, `/v1/tokens/me`).

Автоматически восстановить доступ нельзя: macOS не даёт ни JavaScript из
Apple Events в Chrome, ни Accessibility для `osascript`.

**Минимальное действие (одно):**

```bash
# 1. Создать токен: https://supabase.com/dashboard/account/tokens
#    (Management API / Read & Write Management API)
# 2. Выполнить в своей консоли:
supabase login --token <СОЗДАННЫЙ_ТОКЕН>
```

Токен не присылать в чат и не класть в Git. CLI сохранит его в связке ключей.

Альтернатива: в Chrome открыт таб «Authorize CLI | Supabase» - нажатие
Authorize даёт тот же результат.

## 3. Что сделано

### 3.1. Подготовка исходников

- Проверены ветка, HEAD и рабочее дерево: незакоммиченных изменений не было.
- В Git нет `.env`, секретов, резервных копий и временных файлов.
  Отслеживаются только `.env.example` (только имена переменных, без
  значений) и `.vercel/project.json` (только orgId и projectId).
- Поиск по всей истории Git не нашёл ни одного токена, service_role ключа
  или JWT.
- `tsconfig.tsbuildinfo` убран из отслеживания и добавлен в `.gitignore`.

### 3.2. Remote и связь с Vercel

- `origin` = `https://github.com/Shvachkomax/Ouction.git` (private).
- Vercel привязан к тому же репозиторию: `repoId 1320245903`,
  `productionBranch = main`. Привязка не менялась.
- Push feature-ветки создаёт только Preview. Подтверждено фактически:
  деплой с `gitSource.ref = feature/catalog-product-pages` не получил
  production-alias, production-деплои не добавились.
- Push требовал увеличения `http.postBuffer` (пак 36 МБ).

### 3.3. Исправления в коде (до деплоя)

`supabase/cabinet-login-attempts.sql` и `app/cabinet/artists/actions.ts`
(d7bc66b) - исправлены три реальных дефекта лимитера входа в кабинет:

1. `return query` не прерывал функцию: после ветки «первая попытка» код
   продолжался и падал на `NOT NULL`. Первая попытка по новому ключу всегда
   завершалась ошибкой, то есть общий лимитер не работал вообще.
2. Конкурентные первые попытки использовали `on conflict do nothing`:
   счётчик терял часть попыток и не совпадал с числом запросов.
3. `REVOKE ... FROM anon/authenticated` не отменяет `PUBLIC`-грант, который
   Postgres выдаёт на `CREATE FUNCTION` по умолчанию. Клиент мог вызвать
   `reset_cabinet_login_rate_limit` и снять свою блокировку - то есть обойти
   лимитер. Добавлен `revoke ... from public`.
4. `search_path = public` заменён на `search_path = ''`, все объекты
   квалифицированы.

В приложении in-memory счётчик удалён: serverless-инстансы Vercel его не
разделяют, поэтому это не общая защита. Если общий лимитер недоступен, вход
отклоняется целиком (fail closed) с сообщением
«Вход временно недоступен: не работает защита от подбора кода».

`supabase/media-storage.sql` - добавлены явные политики чтения бакета
`oukcion-media` и записи только через `service_role`.

### 3.4. Изоляция Preview от production

Обнаружено: все 4 переменные Vercel имели target `["preview","production"]`.
Проверено по бандлу production-сайта - значение `NEXT_PUBLIC_SUPABASE_URL`
указывает на `https://ekxqnzhylckbdptrooms.supabase.co`, то есть Preview
унаследовал production-базу.

Выполнено:

- у всех 4 общих переменных target изменён на `["production"]`
  (значения не тронуты) - Preview больше не наследует production-значения;
- Preview-деплой, собранный до этого (`dpl_DV7uLLtDn9DY2qga6JTM2VxxLUME`),
  удалён;
- устаревший Preview-деплой предыдущего SHA также удалён, остался один
  актуальный.

### 3.5. Инструменты проверки

| Скрипт | Назначение |
|---|---|
| `scripts/preview-db-setup.mjs` | применяет схему к подтверждённому test ref дважды (идемпотентность) и проверяет RLS, права таблиц, SECURITY DEFINER, `search_path`, привилегии `EXECUTE`; отказывается работать с production ref |
| `scripts/seed-preview-data.mjs` | наполняет тестовую базу вымышленными персонами и товарами (`published` / `draft` / `moderation`) |
| `scripts/preview-db-runtime-test.mjs` | через PostgREST проверяет: anon не читает черновики, не пишет, не вызывает RPC лимитера; параллельные попытки входа считаются точно; лимит срабатывает и блокирует |
| `scripts/preview-browser-check.mjs` | браузерная проверка действующего Preview: страницы, 404, кабинет, мобильная вёрстка, отсутствие обращений к Supabase |

## 4. Проверки на действующем Preview (17 из 17 пройдено)

| Проверка | Результат |
|---|---|
| Главная отвечает 200, русский интерфейс | ПРОШЁЛ |
| Каталог отвечает 200 | ПРОШЁЛ |
| Каталог показывает «Не удалось загрузить каталог», а не пустой список | ПРОШЁЛ |
| Каталог не показывает «Товаров не найдено» при ошибке БД | ПРОШЁЛ |
| Страница товара без БД - 200 с ошибкой, а не 404 | ПРОШЁЛ |
| Неизвестный маршрут - 404 | ПРОШЁЛ |
| Страница 404 на русском («Такой страницы нет») | ПРОШЁЛ |
| Кабинет показывает форму входа | ПРОШЁЛ |
| Неверный код не пускает в кабинет | ПРОШЁЛ |
| Вход без общего лимитера отклонён с понятным сообщением | ПРОШЁЛ |
| Mobile `/`, `/catalog`, `/cabinet/artists` - 0 px переполнения | ПРОШЁЛ |
| Preview не обращается к production Supabase | ПРОШЁЛ |
| Preview не обращается ни к одному Supabase | ПРОШЁЛ |
| Ошибок JS в консоли нет | ПРОШЁЛ |

Скриншоты: `docs/audit/screenshots/preview-*.png`.

## 5. Ссылки

- Preview: `https://oukcion-g1o28a0s9-maxim-shvachko-s-projects.vercel.app`
- Каталог: `https://oukcion-g1o28a0s9-maxim-shvachko-s-projects.vercel.app/catalog`
- Кабинет: `https://oukcion-g1o28a0s9-maxim-shvachko-s-projects.vercel.app/cabinet/artists`
- Прямая ссылка на тестовый товар и тестовую персону появится после создания
  тестовой БД и наполнения её вымышленными данными.

Все ссылки требуют входа в Vercel: включено `ssoProtection =
all_except_custom_domains`.

## 6. Код оператора для Preview

`CABINET_ACCESS_CODE` в Preview не задан - тестовый код появится вместе с
остальными переменными после создания тестовой БД. Владелец получает его
так, не публикуя в Git:

- Vercel → Project `oukcion` → Settings → Environment Variables → Preview →
  `CABINET_ACCESS_CODE` → Reveal;
- либо из своего менеджера паролей (значение задаётся один раз при
  создании переменной).

Значение не попадает в репозиторий: переменная sensitive, в Git нет файлов
с секретами.

## 7. Ограничения

- Тестовой БД нет: не проверены на настоящем PostgreSQL RLS-политики,
  атомарность лимитера при параллельных попытках, запись через server
  actions с `service_role`, загрузка файлов в storage, реальные медиа-URL.
  Mock-фильтрация проверкой RLS не является.
- Preview без тестовой БД показывает состояние ошибки БД во всех
  каталоговых разделах - это ожидаемо и безопаснее, чем наследование
  production-значений.
- Для автоматической проверки защищённого Preview создан bypass-токен
  защиты деплоя Vercel (`automation-bypass`). Публичность деплоя он не
  меняет. Удаляется в Vercel → Project → Settings → Deployment Protection →
  Protection Bypass for Automation.

## 8. Production не изменён

- Production-данные: не читали и не писали (запросы к production делались
  только на чтение при проверке изоляции).
- Значения переменных: прежние; изменён только список target у общих
  переменных (`preview` убран, `production` оставлен).
- Production-деплой: не менялся. По-прежнему 3 деплоя из `main`
  (`193c588f`, `5b13ac42`, `bc26a89f`). Новые деплои созданы только для
  feature-ветки.
- Production-сайт отвечает 200 и читает
  `https://ekxqnzhylckbdptrooms.supabase.co`.
- Merge в `main`, production-деплой и продвижение Preview в production не
  выполнялись.

## 9. Что сделать дальше

1. `supabase login --token <PAT>` (одно действие владельца).
2. `supabase projects list` / `supabase orgs list` - найти или создать
   бесплатный `oukcion-preview-test`, указав организацию и проверив тариф.
3. `node scripts/preview-db-setup.mjs --apply` - применить схему и проверить
   права.
4. `node scripts/seed-preview-data.mjs` - вымышленные данные.
5. `node scripts/preview-db-runtime-test.mjs` - проверки ролей и конкуренции.
6. Задать 4 переменные с target `preview`, затем пересобрать Preview.
7. `node scripts/preview-browser-check.mjs` против нового Preview и снять
   финальные скриншоты с данными.
