create extension if not exists pgcrypto;

create table if not exists public.physical_products (
  id uuid primary key default gen_random_uuid(),
  artist_slug text not null references public.artists(slug) on update cascade on delete restrict,
  artist_name text not null,
  slug text not null unique,
  title text not null,
  product_type text not null default 'physical',
  category text not null,
  description text not null,
  provenance text not null,
  image_url text,
  price_rub integer not null default 0 check (price_rub >= 0),
  quantity integer not null default 1 check (quantity >= 0),
  condition text not null default 'не указано',
  delivery text not null default 'доставка обсуждается',
  status text not null default 'draft' check (status in ('draft', 'moderation', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_products_artist_slug_idx
on public.physical_products (artist_slug);

create index if not exists physical_products_status_idx
on public.physical_products (status);

alter table public.physical_products enable row level security;

drop policy if exists "Published physical products are publicly readable"
on public.physical_products;

create policy "Published physical products are publicly readable"
on public.physical_products
for select
to anon, authenticated
using (status = 'published');

grant usage on schema public to anon, authenticated;
grant select on table public.physical_products to anon, authenticated;
