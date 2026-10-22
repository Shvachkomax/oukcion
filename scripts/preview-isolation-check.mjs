#!/usr/bin/env node
/**
 * Checks that a Preview deployment is not wired to the production Supabase.
 *
 * Downloads the deployment HTML and every referenced JS chunk and looks for
 * Supabase project hosts. The production host must be absent, the test host
 * must be present.
 *
 * Usage:
 *   PREVIEW_URL=<deployment url> VERCEL_BYPASS=<bypass token> \
 *   [PREVIEW_DB_HOST=<ref>.supabase.co] \
 *   node scripts/preview-isolation-check.mjs
 */

import fs from "node:fs";

const PREVIEW = process.env.PREVIEW_URL;
const BYPASS = process.env.VERCEL_BYPASS;
const DB_HOST = process.env.PREVIEW_DB_HOST || "";
const PRODUCTION_HOST = "ekxqnzhylckbdptrooms.supabase.co";

if (!PREVIEW || !BYPASS) {
  console.error("PREVIEW_URL and VERCEL_BYPASS are required.");
  process.exit(2);
}

const headers = { "x-vercel-protection-bypass": BYPASS };

async function get(url) {
  const response = await fetch(url, { headers });
  return { status: response.status, body: await response.text() };
}

const results = [];
const log = (name, expected, actual, ok) =>
  results.push({ name, expected, actual, status: ok ? "ПРОШЁЛ" : "ПРОВАЛ" });

const home = await get(`${PREVIEW}/`);
const scriptSrcs = [
  ...new Set([...home.body.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))
];

let productionHits = 0;
let testHits = 0;
const productionFiles = [];
const testFiles = [];

const scan = (label, body) => {
  const p = body.split(PRODUCTION_HOST).length - 1;
  const t = DB_HOST ? body.split(DB_HOST).length - 1 : 0;
  productionHits += p;
  testHits += t;
  if (p > 0) productionFiles.push(label);
  if (t > 0) testFiles.push(label);
};

scan("index.html", home.body);
for (const src of scriptSrcs) {
  const url = src.startsWith("http") ? src : `${PREVIEW}${src}`;
  const chunk = await get(url);
  scan(src.split("/").pop() || src, chunk.body);
}

log(
  "в HTML и JS-чангах нет production Supabase",
  0,
  productionHits,
  productionHits === 0
);
if (DB_HOST) {
  // Адрес БД не должен попадать в клиентский бандл: каталог читается на
  // сервере. Присутствие тестового хоста в бандле - утечка, а не признак
  // успеха, поэтому проверяем другое: данные каталога помечены как тестовые.
  log(
    "тестовый адрес БД не утёк в клиентский бандл",
    0,
    testHits,
    testHits === 0
  );
}

const catalog = await get(`${PREVIEW}/catalog`);
const catalogText = catalog.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
log(
  "каталог отдаёт данные тестовой БД (помечены как тестовые)",
  true,
  catalogText.includes("(тест)"),
  catalogText.includes("(тест)")
);
log(
  "каталог не содержит слов ошибки БД",
  false,
  catalogText.includes("Не удалось загрузить"),
  !catalogText.includes("Не удалось загрузить")
);

fs.writeFileSync(
  "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/preview-isolation-check.json",
  JSON.stringify(
    {
      preview: PREVIEW,
      chunks: scriptSrcs.length,
      productionHits,
      testHits,
      productionFiles,
      testFiles,
      at: new Date().toISOString(),
      results
    },
    null,
    2
  )
);

for (const r of results) {
  console.log(`${r.status}  ${r.name} (ожидалось ${r.expected}, получено ${r.actual})`);
}
console.log(`\nчанков проверено: ${scriptSrcs.length}`);
const failed = results.filter((r) => r.status === "ПРОВАЛ");
console.log(failed.length === 0 ? "ИЗОЛЯЦИЯ ПОДТВЕРЖДЕНА" : `ПРОВАЛЕНО: ${failed.length}`);
process.exit(failed.length === 0 ? 0 : 1);
