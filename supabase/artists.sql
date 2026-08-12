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
