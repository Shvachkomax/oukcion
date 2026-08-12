create extension if not exists pgcrypto;

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  city text,
  bio text not null,
  image_url text,
  verified boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 100,
  shop_items_count integer not null default 0 check (shop_items_count >= 0),
  auction_lots_count integer not null default 0 check (auction_lots_count >= 0),
  services_count integer not null default 0 check (services_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.artists enable row level security;

drop policy if exists "Artists are publicly readable" on public.artists;

create policy "Artists are publicly readable"
on public.artists
for select
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on table public.artists to anon, authenticated;

insert into public.artists (
  slug,
  name,
  category,
  city,
  bio,
  image_url,
  verified,
  featured,
  sort_order,
  shop_items_count,
  auction_lots_count,
  services_count
)
values
  (
    'severny-svet',
    'Северный свет',
    'музыка',
    'Москва',
    'Музыкальный проект с витриной подписанных носителей, редких постеров и камерных онлайн-встреч.',
    '/lot-studio.png',
    true,
    true,
    10,
    8,
    3,
    2
  ),
  (
    'dmitry-romanov',
    'Дмитрий Романов',
    'кино',
    'Санкт-Петербург',
    'Актёрский профиль с проверенными предметами со съёмок, автографами и персональными обращениями.',
    '/lot-costume.png',
    true,
    true,
    20,
    5,
    2,
    3
  ),
  (
    'alina-koroleva',
    'Алина Королева',
    'литература',
    'Казань',
    'Авторская карточка для книг, постеров, специальных тиражей и встреч с подписчиками.',
    '/lot-book.png',
    false,
    true,
    30,
    6,
    1,
    1
  )
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  city = excluded.city,
  bio = excluded.bio,
  image_url = excluded.image_url,
  verified = excluded.verified,
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  shop_items_count = excluded.shop_items_count,
  auction_lots_count = excluded.auction_lots_count,
  services_count = excluded.services_count,
  updated_at = now();
