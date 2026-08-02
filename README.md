# Оукцион

Российская платформа, объединяющая интернет-магазин, авторские услуги и аукцион товаров публичных персон.

## Стек

- Next.js App Router
- React
- TypeScript
- Supabase JS
- Vercel

## Локальный запуск

```bash
npm install
npm run dev
```

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Для проекта Supabase используйте существующий проект `ekxqnzhylckbdptrooms`. Схему базы не удалять и новый проект Supabase не создавать.

## Vercel

Проект связан с существующим Vercel Project ID `prj_JLR1FscDMoq1OgvSCqT0aWnVm7oK`.

Настройки сборки:

- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: default / пусто
