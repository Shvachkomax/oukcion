#!/usr/bin/env node
/**
 * Browser check of the Oukcion Preview deployment.
 *
 * Two modes:
 *   - without a database: the pages must fail closed (error state, no
 *     silent empty catalogue) and the cabinet must reject the login;
 *   - with a database (PREVIEW_DB_HOST set): the seeded catalogue must be
 *     visible, drafts and moderation rows must stay hidden, the cabinet must
 *     open with the correct code, and the Preview must talk to the test
 *     database only.
 *
 * Usage:
 *   PREVIEW_URL=<deployment url> VERCEL_BYPASS=<bypass token> \
 *   [PREVIEW_DB_HOST=<ref>.supabase.co] [CABINET_CODE=<code>] \
 *   node scripts/preview-browser-check.mjs
 */

import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
import fs from "node:fs";

const PREVIEW = process.env.PREVIEW_URL;
const BYPASS = process.env.VERCEL_BYPASS;
const DB_HOST = process.env.PREVIEW_DB_HOST || "";
const CABINET_CODE = process.env.CABINET_CODE || "";
const PRODUCT_SLUG = process.env.PRODUCT_SLUG || "test-sketch-42";
const ARTIST_SLUG = process.env.ARTIST_SLUG || "test-anna-vetrova";
const OUT = "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/screenshots";

if (!PREVIEW || !BYPASS) {
  console.error("PREVIEW_URL and VERCEL_BYPASS are required.");
  process.exit(2);
}

const WITH_DB = Boolean(DB_HOST);
const results = [];
const log = (name, expected, actual, ok, extra = {}) =>
  results.push({ name, expected, actual, status: ok ? "ПРОШЁЛ" : "ПРОВАЛ", ...extra });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "ru-RU",
  extraHTTPHeaders: { "x-vercel-protection-bypass": BYPASS }
});
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const seenHosts = new Set();
page.on("request", (req) => {
  const host = new URL(req.url()).hostname;
  if (host.endsWith("supabase.co")) seenHosts.add(host);
});

// Вёрстка использует неразрывные пробелы (U+00A0): перед сравнением
// приводим их к обычным, иначе проверки строк дают ложный провал.
const norm = (text) => text.replace(/\u00a0/g, " ");

const overflowOf = (target) =>
  target.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );

// --- home -----------------------------------------------------------------
const home = await page.goto(`${PREVIEW}/`, { waitUntil: "networkidle" });
log("главная отвечает 200", 200, home.status(), home.status() === 200);
const homeOverflow = await overflowOf(page);
log("главная без горизонтального переполнения", 0, homeOverflow, homeOverflow === 0);
await page.screenshot({ path: `${OUT}/preview-home-desktop.png`, fullPage: true });

// --- catalogue ------------------------------------------------------------
const catalog = await page.goto(`${PREVIEW}/catalog`, { waitUntil: "networkidle" });
log("каталог отвечает 200", 200, catalog.status(), catalog.status() === 200);
const catalogText = norm(await page.innerText("body"));
const catalogOverflow = await overflowOf(page);
log(
  "каталог без горизонтального переполнения",
  0,
  catalogOverflow,
  catalogOverflow === 0
);

if (WITH_DB) {
  log(
    "каталог показывает тестовые данные",
    true,
    catalogText.includes("Анна Ветрова"),
    catalogText.includes("Анна Ветрова")
  );
  log(
    "каталог не показывает состояние ошибки БД",
    false,
    catalogText.includes("Не удалось загрузить каталог"),
    !catalogText.includes("Не удалось загрузить каталог")
  );
  log(
    "опубликованный товар виден",
    true,
    catalogText.includes("Скетч №42"),
    catalogText.includes("Скетч №42")
  );
  log(
    "черновик не виден в каталоге",
    false,
    catalogText.includes("Черновик"),
    !catalogText.includes("Черновик")
  );
  log(
    "товар на модерации не виден в каталоге",
    false,
    catalogText.includes("Модерация"),
    !catalogText.includes("Модерация")
  );
} else {
  const showsError = catalogText.includes("Не удалось загрузить каталог");
  log(
    "каталог показывает состояние ошибки БД (нет молчаливого пустого списка)",
    true,
    showsError,
    showsError
  );
  log(
    "каталог не показывает «Товаров не найдено» при ошибке",
    false,
    catalogText.includes("Товаров не найдено"),
    !catalogText.includes("Товаров не найдено")
  );
}
await page.screenshot({ path: `${OUT}/preview-catalog-desktop.png`, fullPage: true });

// --- product page ---------------------------------------------------------
const product = await page.goto(`${PREVIEW}/products/${PRODUCT_SLUG}`, {
  waitUntil: "networkidle"
});
const productText = norm(await page.innerText("body"));
if (WITH_DB) {
  log("страница опубликованного товара отвечает 200", 200, product.status(), product.status() === 200);
  const productComplete =
    productText.includes("Скетч №42") &&
    productText.includes("15 000") &&
    productText.includes("Анна Ветрова");
  log(
    "страница товара показывает название, цену и персону",
    true,
    productComplete,
    productComplete
  );
  const unknownProduct = await page.goto(`${PREVIEW}/products/test-does-not-exist`, {
    waitUntil: "networkidle"
  });
  log(
    "неизвестный товар отвечает 404",
    404,
    unknownProduct.status(),
    unknownProduct.status() === 404
  );
  const unknownProductText = norm(await page.innerText("body"));
  log(
    "страница 404 на русском",
    true,
    unknownProductText.includes("Такой страницы нет"),
    unknownProductText.includes("Такой страницы нет")
  );
} else {
  log(
    "страница товара без БД отвечает 200 и показывает ошибку, а не 404",
    true,
    product.status() === 200 && productText.includes("Не удалось загрузить товар"),
    product.status() === 200 && productText.includes("Не удалось загрузить товар")
  );
}
await page.goto(`${PREVIEW}/products/${PRODUCT_SLUG}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/preview-product-desktop.png`, fullPage: true });

// --- artist page ----------------------------------------------------------
const artist = await page.goto(`${PREVIEW}/artists/${ARTIST_SLUG}`, {
  waitUntil: "networkidle"
});
const artistText = norm(await page.innerText("body"));
if (WITH_DB) {
  log("страница персоны отвечает 200", 200, artist.status(), artist.status() === 200);
  log(
    "страница персоны показывает имя",
    true,
    artistText.includes("Анна Ветрова"),
    artistText.includes("Анна Ветрова")
  );
  const unknownArtist = await page.goto(`${PREVIEW}/artists/test-does-not-exist`, {
    waitUntil: "networkidle"
  });
  log(
    "неизвестная персона отвечает 404",
    404,
    unknownArtist.status(),
    unknownArtist.status() === 404
  );
} else {
  log(
    "страница персоны без БД показывает ошибку, а не 404",
    true,
    artist.status() === 200 && artistText.includes("Не удалось загрузить персону"),
    artist.status() === 200 && artistText.includes("Не удалось загрузить персону")
  );
}
await page.goto(`${PREVIEW}/artists/${ARTIST_SLUG}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/preview-artist-desktop.png`, fullPage: true });

// --- 404 ------------------------------------------------------------------
const notFound = await page.goto(`${PREVIEW}/no-such-route`, {
  waitUntil: "networkidle"
});
log("неизвестный маршрут отвечает 404", 404, notFound.status(), notFound.status() === 404);
const nfText = norm(await page.innerText("body"));
log(
  "страница 404 на русском",
  true,
  nfText.includes("Такой страницы нет"),
  nfText.includes("Такой страницы нет")
);

// --- cabinet --------------------------------------------------------------
await page.goto(`${PREVIEW}/cabinet/artists`, { waitUntil: "networkidle" });
const hasForm = await page.locator('input[name="accessCode"]').count();
log("кабинет показывает форму входа", 1, hasForm, hasForm === 1);

await page.fill('input[name="accessCode"]', "wrong-code-for-preview");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);

const cabinetUrl = page.url();
const cabinetText = norm(await page.innerText("body"));
log(
  "неверный код не пускает в кабинет",
  true,
  cabinetUrl.includes("error=") || cabinetText.includes("Войти"),
  cabinetUrl.includes("error=") || cabinetText.includes("Войти")
);

if (WITH_DB && CABINET_CODE) {
  log(
    "неверный код отклонён с сообщением о неверном коде",
    true,
    cabinetText.includes("Неверный код доступа"),
    cabinetText.includes("Неверный код доступа")
  );
  log(
    "общий лимитер доступен (нет сообщения о недоступности лимитера)",
    false,
    cabinetText.includes("не работает защита от подбора кода"),
    !cabinetText.includes("не работает защита от подбора кода")
  );

  await page.goto(`${PREVIEW}/cabinet/artists`, { waitUntil: "networkidle" });
  await page.fill('input[name="accessCode"]', CABINET_CODE);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.search.includes("error="), { timeout: 20000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("Анна Ветрова"),
    undefined,
    { timeout: 20000 }
  );

  const afterLoginUrl = page.url();
  const afterLoginText = norm(await page.innerText("body"));
  log(
    "верный код открывает кабинет",
    true,
    !afterLoginUrl.includes("error=") && afterLoginText.includes("Анна Ветрова"),
    !afterLoginUrl.includes("error=") && afterLoginText.includes("Анна Ветрова")
  );
  await page.screenshot({ path: `${OUT}/preview-cabinet-desktop.png`, fullPage: true });
} else {
  log(
    "вход без общего лимитера отклонён с понятным сообщением",
    true,
    cabinetText.includes("rate-limiter-unavailable") ||
      cabinetText.includes("не работает защита от подбора кода"),
    cabinetText.includes("не работает защита от подбора кода")
  );
  await page.screenshot({ path: `${OUT}/preview-cabinet-desktop.png`, fullPage: true });
}

// --- mobile ---------------------------------------------------------------
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "ru-RU",
  extraHTTPHeaders: { "x-vercel-protection-bypass": BYPASS }
});
const mpage = await mctx.newPage();
for (const path of [
  "/",
  "/catalog",
  `/products/${PRODUCT_SLUG}`,
  `/artists/${ARTIST_SLUG}`,
  "/cabinet/artists"
]) {
  await mpage.goto(`${PREVIEW}${path}`, { waitUntil: "networkidle" });
  const overflow = await overflowOf(mpage);
  log(`mobile ${path} без горизонтального переполнения`, 0, overflow, overflow === 0);
}
await mpage.goto(`${PREVIEW}/catalog`, { waitUntil: "networkidle" });
await mpage.screenshot({ path: `${OUT}/preview-catalog-mobile.png`, fullPage: true });
await mpage.goto(`${PREVIEW}/products/${PRODUCT_SLUG}`, { waitUntil: "networkidle" });
await mpage.screenshot({ path: `${OUT}/preview-product-mobile.png`, fullPage: true });

// --- isolation ------------------------------------------------------------
const productionHosts = [...seenHosts].filter((h) => h.startsWith("ekxqnzhylckbdptrooms"));
log(
  "Preview не обращается к production Supabase",
  0,
  productionHosts.length,
  productionHosts.length === 0
);
// Каталог читается на сервере, поэтому из браузера запросов к Supabase
// быть не должно вовсе: прямой доступ клиента к базе - утечка ключа.
log(
  "браузер не обращается к Supabase напрямую",
  0,
  seenHosts.size,
  seenHosts.size === 0
);

const realErrors = consoleErrors.filter((e) => !e.includes("Failed to load resource"));
log(
  "нет JS-ошибок в консоли",
  0,
  realErrors.length,
  realErrors.length === 0,
  { sample: realErrors.slice(0, 3) }
);

await browser.close();

fs.writeFileSync(
  "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/preview-browser-check.json",
  JSON.stringify(
    { preview: PREVIEW, withDatabase: WITH_DB, at: new Date().toISOString(), results },
    null,
    2
  )
);

const failed = results.filter((r) => r.status === "ПРОВАЛ");
console.log("");
for (const r of results) {
  console.log(`${r.status}  ${r.name} (ожидалось ${r.expected}, получено ${r.actual})`);
}
console.log(
  `\n${failed.length === 0 ? "ВСЕ ПРОВЕРКИ ПРОШЛИ" : `ПРОВАЛЕНО: ${failed.length}`}`
);
process.exit(failed.length === 0 ? 0 : 1);
