# Конфигурация Preview-окружения Оукцион

Окружение: Vercel Preview → отдельный тестовый Supabase-проект.
Production-проект `ekxqnzhylckbdptrooms` для Preview **не используется**.

## 1. Тестовая база данных

### 1.1. Создание проекта (нужен доступ владельца)

```bash
supabase login
supabase projects create oukction-preview \
  --org-id <ORG_ID> \
  --db-password <ПАРОЛЬ_БД> \
  --region <REGION> \
  --plan free
```

План `free` не создаёт платных ресурсов. Ограничение: 2 бесплатных проекта на аккаунт.

Если лимит исчерпан - использовать локальный `supabase start` и проксировать
Preview через туннель, либо попросить владельца освободить слот.

### 1.2. Применение схемы

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push                      # применит supabase/migrations/*
```

Либо вручную, в порядке применения:

1. `supabase/artists.sql` - таблица `artists` + RLS + публичная политика чтения
2. `supabase/physical-products.sql` - таблица `physical_products` + RLS + политика чтения
3. `supabase/media-storage.sql` - bucket `oukcion-media` (public)
4. `supabase/cabinet-login-attempts.sql` - таблица лимитера входа (service_role only)

`supabase/remove-demo-artists.sql` на тестовой базе не применять - там нет демо-персон.

### 1.3. Проверка прав после применения

```sql
-- Читать должен видеть только опубликованное
set local role anon;
select count(*) from public.artists;
select count(*) from public.physical_products where status = 'published';

-- Черновик не должен читаться из таблицы лимитера
set local role anon;
select count(*) from public.cabinet_login_attempts;  -- ожидается ошибка доступа
```

## 2. Переменные Preview

Задать в Vercel → Project `oukcion` → Settings → Environments → **Preview**.

| Переменная | Значение | Обязательна |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | да |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key тестового проекта | да |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key тестового проекта | да |
| `CABINET_ACCESS_CODE` | произвольный код доступа в кабинет (не production-значение) | да |

Production-окружение оставить без изменений.

## 3. Ограничения доступа

- `SUPABASE_SERVICE_ROLE_KEY` используется только в `lib/supabase-admin.ts`
  (кабинет оператора, загрузка файлов). Публичное чтение каталога идёт
  через anon-ключ - см. `lib/supabase.ts`.
- `CABINET_ACCESS_CODE` в Preview задаётся отдельный.
- Тестовая база не должна содержать реальных персональных данных.

## 4. Чек-лист перед первым деплоем Preview

- [ ] `supabase projects list` показывает отдельный preview-проект
- [ ] Схема применена, `select status, count(*) from physical_products group by status`
      возвращает только `published` и `draft`
- [ ] `artists` содержит тестовые персоны с `featured = true`
- [ ] Bucket `oukcion-media` существует и `public = true`
- [ ] `cabinet_login_attempts` недоступна для anon (проверка через curl с publishable key)
- [ ] Переменные Preview заданы, production-окружение не тронуто
- [ ] `npm run lint && npm run typecheck && npm run build` проходят локально

## 5. Что проверяется на Preview

1. Главная → каталог → товар → персона работают на реальном Supabase.
2. RLS действительно скрывает черновики (это нельзя проверить на mock).
3. Запись в кабинете оператора работает и не пишет в production.
4. Rate-limit входа работает на настоящем PostgreSQL (конкурентные попытки).
5. Загрузка медиа в bucket работает.

## 6. Откат

Preview-деплой не влияет на production. Откат Preview = переключение Preview
на предыдущий деплой Vercel или удаление тестового проекта Supabase.

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

- Реальные медиа-URL из бакета `oukcion-media` (на preview - пусто).
- Запись через server actions с `service_role`.
- Загрузка файлов в storage.
- Кэширование страниц с `revalidate` на реальных данных.

## 8. Текущее состояние окружения (на 2026-10-21)

| Окружение | Привязка | Состояние |
|---|---|---|
| Production | `Shvachkomax/Ouction:main` → Vercel `oukcion` (`prj_JLR1FscDMoq1OgvSCqT0aWnVm7oK`) | Работает, данные видны |
| Preview | Тот же Vercel-проект, env существуют | **Env указывают на production Supabase** - писать нельзя |
| Supabase CLI | `supabase projects list` → `Invalid access token` | Требуется `supabase logout && supabase login` |

Переменные в Vercel Preview (`CABINET_ACCESS_CODE`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) созданы
70 дней назад и относятся к production-проекту Supabase.

**До появления отдельного preview-проекта Supabase деплоить Preview нельзя:**
запись в кабинете попадёт в production-таблицы.
