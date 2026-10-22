#!/usr/bin/env node
/**
 * Browser check of the Oukcion Preview deployment.
 *
 * Verifies that the Preview renders, cannot reach the production Supabase,
 * and fails closed on the cabinet login when the shared rate limiter is not
 * configured.
 *
 * Usage:
 *   PREVIEW_URL=<deployment url> \
 *   VERCEL_BYPASS=<protection bypass token> \
 *   node scripts/preview-browser-check.mjs
 */

import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
import fs from "node:fs";

const PREVIEW = process.env.PREVIEW_URL;
const BYPASS = process.env.VERCEL_BYPASS;
const OUT = "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/screenshots";

if (!PREVIEW || !BYPASS) {
  console.error("PREVIEW_URL and VERCEL_BYPASS are required.");
  process.exit(2);
}

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

// --- home -----------------------------------------------------------------
const home = await page.goto(`${PREVIEW}/`, { waitUntil: "networkidle" });
log("главная отвечает 200", 200, home.status(), home.status() === 200);
const homeOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
log(
  "главная без горизонтального переполнения",
  0,
  homeOverflow,
  homeOverflow === 0
);
await page.screenshot({ path: `${OUT}/preview-home-desktop.png`, fullPage: true });

// --- catalog --------------------------------------------------------------
const catalog = await page.goto(`${PREVIEW}/catalog`, { waitUntil: "networkidle" });
log("каталог отвечает 200", 200, catalog.status(), catalog.status() === 200);
const catalogText = await page.innerText("body");
const catalogShowsError = catalogText.includes("Не удалось загрузить каталог");
log(
  "каталог показывает состояние ошибки БД (нет молчаливого пустого списка)",
  true,
  catalogShowsError,
  catalogShowsError
);
log(
  "каталог не показывает «Товаров не найдено» при ошибке",
  false,
  catalogText.includes("Товаров не найдено"),
  !catalogText.includes("Товаров не найдено")
);
await page.screenshot({ path: `${OUT}/preview-catalog-desktop.png`, fullPage: true });

// --- product page without a database -------------------------------------
// Без подключённой БД страница товара обязана показать состояние ошибки,
// а не выдавать 404: «нет товара» и «не читается база» - разные ситуации.
const productPage = await page.goto(`${PREVIEW}/products/test-does-not-exist`, {
  waitUntil: "networkidle"
});
const productText = await page.innerText("body");
log(
  "страница товара без БД отвечает 200 и показывает ошибку, а не 404",
  true,
  productPage.status() === 200 && productText.includes("Не удалось загрузить товар"),
  productPage.status() === 200 && productText.includes("Не удалось загрузить товар")
);

// --- 404 ------------------------------------------------------------------
const notFound = await page.goto(`${PREVIEW}/no-such-route`, {
  waitUntil: "networkidle"
});
log("неизвестный маршрут отвечает 404", 404, notFound.status(), notFound.status() === 404);
const nfText = await page.innerText("body");
log(
  "страница 404 на русском",
  true,
  nfText.includes("Такой страницы нет"),
  nfText.includes("Такой страницы нет")
);

// --- cabinet login (fail closed) -----------------------------------------
await page.goto(`${PREVIEW}/cabinet/artists`, { waitUntil: "networkidle" });
const hasForm = await page.locator('input[name="accessCode"]').count();
log("кабинет показывает форму входа", 1, hasForm, hasForm === 1);

await page.fill('input[name="accessCode"]', "wrong-code-for-preview");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);

const cabinetUrl = page.url();
const cabinetText = await page.innerText("body");
log(
  "неверный код не пускает в кабинет",
  true,
  cabinetUrl.includes("error=") || cabinetText.includes("Войти"),
  cabinetUrl.includes("error=") || cabinetText.includes("Войти")
);
log(
  "вход без общего лимитера отклонён с понятным сообщением",
  true,
  cabinetText.includes("rate-limiter-unavailable") ||
    cabinetText.includes("не работает защита от подбора кода"),
  cabinetText.includes("не работает защита от подбора кода")
);
await page.screenshot({ path: `${OUT}/preview-cabinet-desktop.png`, fullPage: true });

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
for (const path of ["/", "/catalog", "/cabinet/artists"]) {
  await mpage.goto(`${PREVIEW}${path}`, { waitUntil: "networkidle" });
  const overflow = await mpage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  log(`mobile ${path} без горизонтального переполнения`, 0, overflow, overflow === 0);
}
await mpage.goto(`${PREVIEW}/catalog`, { waitUntil: "networkidle" });
await mpage.screenshot({ path: `${OUT}/preview-catalog-mobile.png`, fullPage: true });

// --- isolation ------------------------------------------------------------
const productionHosts = [...seenHosts].filter((h) => h.startsWith("ekxqnzhylckbdptrooms"));
log(
  "Preview не обращается к production Supabase",
  0,
  productionHosts.length,
  productionHosts.length === 0
);
log("Preview не обращается ни к одному Supabase", 0, seenHosts.size, seenHosts.size === 0);

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
  JSON.stringify({ preview: PREVIEW, at: new Date().toISOString(), results }, null, 2)
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
