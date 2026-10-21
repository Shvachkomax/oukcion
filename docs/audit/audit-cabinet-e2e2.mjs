import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const OUT = "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/screenshots";
const results = [];
const log = (name, expected, actual, ok, extra = {}) =>
  results.push({ name, expected, actual, status: ok ? "ПРОШЁЛ" : "ПРОВАЛ", ...extra });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ru-RU" });
const page = await ctx.newPage();

await fetch("http://localhost:3002/reset", { method: "POST" });

// login
await page.goto(`${BASE}/cabinet/artists`, { waitUntil: "networkidle" });
await page.fill('input[name="accessCode"]', "diag-access-code");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1000);

// create an artist to attach products to
const af = page.locator('form:has(input[name="name"])').first();
await af.locator('input[name="name"]').fill("Загрузка Тест");
await af.locator('input[name="category"]').fill("группа");
await af.locator('textarea[name="bio"]').fill("Проверка загрузки фото.");
await af.locator('button[type="submit"]').click();
await page.waitForTimeout(2200);

// ---------- U1: valid image upload ----------
const pf = page.locator("form.productForm");
await pf.locator('select[name="artist"]').selectOption({ index: 1 });
await pf.locator('input[name="title"]').fill("Товар с фото");
await pf.locator('input[name="price_rub"]').fill("1000");
await pf.locator('input[name="quantity"]').fill("1");
await pf.locator('textarea[name="description"]').fill("С фотографией.");
await pf.locator('textarea[name="provenance"]').fill("Тест.");
await pf.locator('select[name="category"]').selectOption({ label: "Печатная продукция" });
await pf.locator('select[name="status"]').selectOption("published");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
await pf.locator('input[name="image_file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
await pf.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
let st = await (await fetch("http://localhost:3002/state")).json();
const withImg = st.products.find((p) => p.title === "Товар с фото");
log(
  "U1 Загрузка изображения товара",
  "файл сохранён в storage, image_url заполнен",
  withImg?.image_url ? `image_url=${withImg.image_url}` : "image_url НЕ заполнен",
  !!withImg?.image_url,
  { storageKeys: st.storage }
);

// ---------- U2: disallowed mime type ----------
await pf.locator('select[name="artist"]').selectOption({ index: 1 });
await pf.locator('input[name="title"]').fill("Товар с SVG");
await pf.locator('input[name="price_rub"]').fill("1000");
await pf.locator('input[name="quantity"]').fill("1");
await pf.locator('textarea[name="description"]').fill("SVG.");
await pf.locator('textarea[name="provenance"]').fill("Тест.");
await pf.locator('select[name="category"]').selectOption({ label: "Печатная продукция" });
await pf.locator('input[name="image_file"]').setInputFiles({
  name: "evil.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from("<svg onload=alert(1)></svg>")
});
await pf.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
const svgMsg = await page.locator(".formStatus.error").last().textContent().catch(() => null);
st = await (await fetch("http://localhost:3002/state")).json();
log(
  "U2 Загрузка запрещённого формата (SVG) отклоняется",
  "сообщение об ошибке, товар не создан",
  svgMsg ? `UI: "${svgMsg.trim()}"` : "сообщения нет",
  !!svgMsg && !st.products.find((p) => p.title === "Товар с SVG"),
  { severity: "P1" }
);

// ---------- U3: oversized file ----------
await pf.locator('select[name="artist"]').selectOption({ index: 1 });
await pf.locator('input[name="title"]').fill("Товар с большим фото");
await pf.locator('input[name="price_rub"]').fill("1000");
await pf.locator('input[name="quantity"]').fill("1");
await pf.locator('textarea[name="description"]').fill("Большое фото.");
await pf.locator('textarea[name="provenance"]').fill("Тест.");
await pf.locator('select[name="category"]').selectOption({ label: "Печатная продукция" });
await pf.locator('input[name="image_file"]').setInputFiles({
  name: "big.png",
  mimeType: "image/png",
  buffer: Buffer.alloc(5 * 1024 * 1024, 1)
});
await pf.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
const bigMsg = await page.locator(".formStatus.error").last().textContent().catch(() => null);
st = await (await fetch("http://localhost:3002/state")).json();
log(
  "U3 Файл больше 4 МБ отклоняется",
  "сообщение об ошибке, товар не создан",
  bigMsg ? `UI: "${bigMsg.trim()}"` : "сообщения нет",
  !!bigMsg && !st.products.find((p) => p.title === "Товар с большим фото")
);

// ---------- U4: shop_items_count reset on artist re-save ----------
st = await (await fetch("http://localhost:3002/state")).json();
const artistBefore = st.artists[0];
const af2 = page.locator('form:has(input[name="name"])').first();
await af2.locator('input[name="name"]').fill("Загрузка Тест");
await af2.locator('input[name="category"]').fill("группа");
await af2.locator('textarea[name="bio"]').fill("Проверка загрузки фото (повторно).");
await af2.locator('button[type="submit"]').click();
await page.waitForTimeout(2200);
st = await (await fetch("http://localhost:3002/state")).json();
const artistAfter = st.artists[0];
log(
  "U4 Повторное сохранение артиста не затирает shop_items_count",
  `shop_items_count сохранён (=${artistBefore.shop_items_count})`,
  `shop_items_count: ${artistBefore.shop_items_count} -> ${artistAfter.shop_items_count}`,
  artistBefore.shop_items_count === artistAfter.shop_items_count,
  { severity: "P2" }
);

// ---------- U5: artist with products -> delete blocked message ----------
page.on("dialog", (d) => d.accept());
await page.locator('form:has(input[name="slug"]) button.rowDangerButton').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(2000);
const blockMsg = await page.locator(".formStatus.error").first().textContent().catch(() => null);
st = await (await fetch("http://localhost:3002/state")).json();
log(
  "U5 Удаление артиста с товарами блокируется и объясняется",
  "понятное сообщение пользователю",
  blockMsg ? `UI: "${blockMsg.trim()}"` : "сообщения нет",
  !!blockMsg && st.artists.length === 1
);

// ---------- U6: slug uniqueness / two artists same slug ----------
await af2.locator('input[name="name"]').fill("Дубль");
await af2.locator('input[name="slug"]').fill("zagruzka-test");
await af2.locator('input[name="category"]').fill("группа");
await af2.locator('textarea[name="bio"]').fill("Первый.");
await af2.locator('button[type="submit"]').click();
await page.waitForTimeout(2000);
st = await (await fetch("http://localhost:3002/state")).json();
const n1 = st.artists.filter((a) => a.slug === "zagruzka-test").length;
await af2.locator('input[name="name"]').fill("Дубль 2");
await af2.locator('input[name="slug"]').fill("zagruzka-test");
await af2.locator('input[name="category"]').fill("группа");
await af2.locator('textarea[name="bio"]').fill("Второй.");
await af2.locator('button[type="submit"]').click();
await page.waitForTimeout(2000);
st = await (await fetch("http://localhost:3002/state")).json();
const n2 = st.artists.filter((a) => a.slug === "zagruzka-test").length;
log(
  "U6 Повторный slug артиста перезаписывает карточку (upsert)",
  "одна запись на slug",
  `после 1-го: ${n1}, после 2-го: ${n2} (bio: "${st.artists.find((a) => a.slug === "zagruzka-test")?.bio}")`,
  n2 === 1,
  { severity: n2 === 1 ? "P2 (перезапись без предупреждения)" : "" }
);

// ---------- U7: featured artist appears in nav + section ----------
st = await (await fetch("http://localhost:3002/state")).json();
const featured = st.artists.filter((a) => a.featured);
await fetch("http://localhost:3002/seed", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ artists: st.artists, products: st.products })
});
await page.goto(`${BASE}/?nc=${Date.now()}`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const home = await page.content();
log(
  "U7 В шапке появляется пункт «Артисты» при наличии featured-артистов",
  "ссылка #artists в навигации",
  home.includes('href="#artists"') ? "есть" : "НЕТ (featured-артистов: " + featured.length + ")",
  featured.length === 0 ? true : home.includes('href="#artists"')
);

// ---------- U8: artist page (public figure page) exists? ----------
const r = await fetch(`${BASE}/artists/zagruzka-test`).then((x) => x.status).catch(() => 0);
const r2 = await fetch(`${BASE}/artist/zagruzka-test`).then((x) => x.status).catch(() => 0);
log(
  "U8 Нет публичной страницы публичной персоны",
  "маршрут страницы персоны отсутствует (404)",
  `/artists/zagruzka-test -> ${r}, /artist/zagruzka-test -> ${r2}`,
  r === 404 && r2 === 404,
  { severity: "P0 (нет страницы персоны)" }
);

// ---------- U9: no product detail page ----------
const r3 = await fetch(`${BASE}/products/zagruzka-test-vinil`).then((x) => x.status).catch(() => 0);
log(
  "U9 Нет детальной страницы товара",
  "маршрут 404",
  `/products/... -> ${r3}`,
  r3 === 404,
  { severity: "P0 (нет карточки товара)" }
);

// ---------- U10: no auth for customers ----------
const r4 = await fetch(`${BASE}/login`).then((x) => x.status).catch(() => 0);
const r5 = await fetch(`${BASE}/cabinet`).then((x) => x.status).catch(() => 0);
log(
  "U10 Нет клиентского входа/регистрации",
  "маршруты 404",
  `/login -> ${r4}, /cabinet -> ${r5}`,
  r4 === 404 && r5 === 404,
  { severity: "P0 (нет идентификации покупателя)" }
);

await browser.close();
fs.writeFileSync(
  "/var/folders/bq/dwfnvhjs5h192n4syngj695r0000gn/T/opencode/cabinet-e2e2.json",
  JSON.stringify({ results }, null, 2)
);
for (const r of results) {
  console.log(`[${r.status}] ${r.name}\n    ожидалось: ${r.expected}\n    фактически: ${r.actual}`);
}
