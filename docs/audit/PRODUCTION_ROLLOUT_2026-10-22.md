# Выкатка каталога в production - 2026-10-22

Каталог, карточки товара и персоны, кабинет с лимитером входа выкачены в
production. Production-данные не перезаписывались, тестовые данные в
production не попали.

## Что задеплоено

| Параметр | Значение |
|---|---|
| Ветка | `main` (merge `08cc3d8`), исходная ветка `feature/catalog-product-pages` |
| Production-деплой | `dpl_7skK9vwKsMSodPaJbSfUznFZqMCC` |
| Адрес | `https://oukcion.vercel.app` |
| Предыдущий production-деплой | `dpl_CaBhguUHad2aZN9wofzFWj8iXjyB` (`193c588`) |

`main` в `Shvachkomax/Ouction` указывал на ранний снимок `d5a34f9` без
кабинета и каталога. История production-кода лежала в
`Shvachkomax/oukcion` (`193c588`) и уже входила в ветку каталога.
Слияние `-s ours` зафиксировало старую историю без изменения файлов,
поэтому `main` обновился fast-forward, без force-push.

## Изменения в production-БД

Проект `ekxqnzhylckbdptrooms`. Перед изменениями снят снимок данных и
прав: `/tmp/oukcion-prod-rollback/` (владелец машины, вне Git).

| Изменение | Причина |
|---|---|
| Применён `supabase/cabinet-login-attempts.sql` | таблицы и RPC лимитера входа в production не было - кабинет работал бы fail-closed и не пускал бы никого |
| Применены `supabase/artists.sql`, `supabase/physical-products.sql` | закрыт дефект привилегий: у `anon` и `authenticated` были `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` на таблицы каталога. RLS закрывал строки, но не `TRUNCATE` и не `REFERENCES` |
| Применён `supabase/media-storage.sql` | у бакета `oukcion-media` не было политик storage |
| Схема и данные не менялись | таблицы уже существовали с той же структурой; 3 персоны и 1 товар на месте |

После применения у `anon` и `authenticated` на `artists` и
`physical_products` остаётся только `SELECT`; `cabinet_login_attempts`
клиентам недоступна; обе RPC - `SECURITY DEFINER`, `search_path = ''`,
execute только у `service_role`.

## Проверки production

Сразу после деплоя, на `https://oukcion.vercel.app`:

| Проверка | Результат |
|---|---|
| `/` | 200, тестовых данных нет |
| `/catalog` | 200, показывает опубликованный товар и цену |
| `/products/madona` | 200, название, цена, состояние, доставка |
| `/artists/madona` | 200 |
| `/cabinet/artists` | 200, форма кода; неверный код отклонён |
| `/products/test-sketch-42` | 404 (тестовые данные не утекли) |
| `/no-such-route` | 404 |
| Мобильные `/`, `/catalog`, товар, персона | без горизонтального переполнения |
| JS-ошибки на страницах каталога | нет |

PostgREST от имени `anon`: читает 3 персоны и 1 опубликованный товар;
запись в `artists`, выборка из `cabinet_login_attempts` и вызов RPC
лимитера отклоняются.

## Известная мелочь

`/favicon.ico` отдаёт 404: в `app/` нет иконки. Так было и на предыдущем
production-деплое, к выкатке отношения не имеет.

## Откат

1. Vercel → Project `oukcion` → Deployments → `dpl_CaBhguUHad2aZN9wofzFWj8iXjyB`
   → Instant Rollback. Код вернётся к `193c588`.
2. БД откатывать не требуется: изменения аддитивные, схема и данные
   прежние. Если понадобится вернуть прежние привилегии, снимок лежит в
   `/tmp/oukcion-prod-rollback/grants.json`, данные - в `artists.json` и
   `physical_products.json`.

Откат кода без отката БД безопасен: старый код не использует
`cabinet_login_attempts` и не пишет в каталоговые таблицы клиентскими
ролями.

## Что не проверено

- вход в production-кабинет с настоящим кодом доступа и сохранение
  карточки с загрузкой фото - требует кода владельца;
- поведение под нагрузкой.
