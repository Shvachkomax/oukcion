#!/usr/bin/env node
/**
 * Seeds the isolated Preview database with fictional artists and products.
 *
 * Only invented data is used. The script refuses to run against production.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<pat> PREVIEW_PROJECT_REF=<ref> \
 *   node scripts/seed-preview-data.mjs
 */

import { createHash } from "node:crypto";

const PRODUCTION_REF = "ekxqnzhylckbdptrooms";
const MANAGEMENT_API = "https://api.supabase.com";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.PREVIEW_PROJECT_REF;

if (!token || !projectRef) {
  console.error("SUPABASE_ACCESS_TOKEN and PREVIEW_PROJECT_REF are required.");
  process.exit(2);
}

if (projectRef === PRODUCTION_REF) {
  console.error(`Refusing to seed the production project ${PRODUCTION_REF}.`);
  process.exit(2);
}

async function runSql(query) {
  const response = await fetch(
    `${MANAGEMENT_API}/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SQL failed (${response.status}): ${text.slice(0, 600)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Fiction only. Slugs are prefixed with "test-" so nothing can be confused
// with real catalogue entries.
const artists = [
  {
    slug: "test-anna-vetrova",
    name: "Анна Ветрова (тест)",
    category: "иллюстратор",
    city: "Москва",
    bio: "Вымышленная персона для проверки Preview: рисует карандашом по бумаге.",
    verified: true,
    featured: true,
    sort_order: 10
  },
  {
    slug: "test-pavel-gusev",
    name: "Павел Гусев (тест)",
    category: "керамист",
    city: "Казань",
    bio: "Вымышленная персона для проверки Preview: лепит керамику по выходным.",
    verified: false,
    featured: true,
    sort_order: 20
  },
  {
    slug: "test-sonya-imer",
    name: "Соня Имер (тест)",
    category: "певец",
    city: null,
    bio: "Вымышленная персона для проверки Preview: поёт в дуэте сynthetic.",
    verified: false,
    featured: false,
    sort_order: 30
  }
];

const products = [
  {
    artist_slug: "test-anna-vetrova",
    artist_name: "Анна Ветрова (тест)",
    slug: "test-sketch-42",
    title: "Скетч №42 (тест)",
    category: "графика",
    description: "Вымышленный товар для проверки Preview: лист карандашной графики.",
    provenance: "Из вымышленной мастерской.",
    price_rub: 15000,
    quantity: 2,
    condition: "новое",
    delivery: "самовывоз",
    status: "published"
  },
  {
    artist_slug: "test-anna-vetrova",
    artist_name: "Анна Ветрова (тест)",
    slug: "test-sketch-draft",
    title: "Черновик эскиза (тест)",
    category: "графика",
    description: "Вымышленный черновик: не должен быть виден в публичном каталоге.",
    provenance: "Из вымышленной мастерской.",
    price_rub: 3000,
    quantity: 1,
    condition: "не указано",
    delivery: "доставка обсуждается",
    status: "draft"
  },
  {
    artist_slug: "test-pavel-gusev",
    artist_name: "Павел Гусев (тест)",
    slug: "test-vase-blue",
    title: "Ваза «Синяя» (тест)",
    category: "керамика",
    description: "Вымышленный товар для проверки Preview: глазурованная ваза ручной работы.",
    provenance: "Из вымышленной мастерской.",
    price_rub: 24000,
    quantity: 0,
    condition: "новое",
    delivery: "самовывоз",
    status: "published"
  },
  {
    artist_slug: "test-pavel-gusev",
    artist_name: "Павел Гусев (тест)",
    slug: "test-vase-moderation",
    title: "Ваза на модерации (тест)",
    category: "керамика",
    description: "Вымышленный товар на модерации: не должен быть виден в каталоге.",
    provenance: "Из вымышленной мастерской.",
    price_rub: 12000,
    quantity: 1,
    condition: "новое",
    delivery: "доставка обсуждается",
    status: "moderation"
  }
];

function literal(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  for (const artist of artists) {
    await runSql(`
      insert into public.artists
        (slug, name, category, city, bio, verified, featured, sort_order)
      values
        (${literal(artist.slug)}, ${literal(artist.name)}, ${literal(artist.category)}, ${literal(artist.city)}, ${literal(artist.bio)}, ${artist.verified}, ${artist.featured}, ${artist.sort_order})
      on conflict (slug) do update set
        name = excluded.name,
        category = excluded.category,
        city = excluded.city,
        bio = excluded.bio,
        verified = excluded.verified,
        featured = excluded.featured,
        sort_order = excluded.sort_order,
        updated_at = now();
    `);
    console.log(`artist seeded: ${artist.slug}`);
  }

  for (const product of products) {
    await runSql(`
      insert into public.physical_products
        (artist_slug, artist_name, slug, title, category, description, provenance,
         price_rub, quantity, condition, delivery, status)
      values
        (${literal(product.artist_slug)}, ${literal(product.artist_name)}, ${literal(product.slug)}, ${literal(product.title)}, ${literal(product.category)}, ${literal(product.description)}, ${literal(product.provenance)},
         ${product.price_rub}, ${product.quantity}, ${literal(product.condition)}, ${literal(product.delivery)}, ${literal(product.status)})
      on conflict (slug) do update set
        artist_name = excluded.artist_name,
        title = excluded.title,
        category = excluded.category,
        description = excluded.description,
        provenance = excluded.provenance,
        price_rub = excluded.price_rub,
        quantity = excluded.quantity,
        condition = excluded.condition,
        delivery = excluded.delivery,
        status = excluded.status,
        updated_at = now();
    `);
    console.log(`product seeded: ${product.slug} (${product.status})`);
  }

  const counts = await runSql(`
    select
      (select count(*) from public.artists) as artists,
      (select count(*) from public.physical_products) as products;
  `);
  console.log("counts:", JSON.stringify(counts));
  console.log("seed fingerprint:", createHash("sha256").update(JSON.stringify(products.map((p) => p.slug))).digest("hex").slice(0, 12));
}

await main();
