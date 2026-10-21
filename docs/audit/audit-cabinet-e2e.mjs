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
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

// reset mock
await fetch("http://localhost:3002/reset", { method: "POST" });

// ---------- S1: wrong access code ----------
await page.goto(`${BASE}/cabinet/artists`, { waitUntil: "networkidle" });
await page.fill('input[name="accessCode"]', "wrong-code");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
const wrongMsg = await page.locator(".formStatus.error").first().textContent().catch(() => null);
log(
  "S1 Вход с неверным кодом отклоняется",
  "показано «Неверный код доступа», вход не выдан",
  wrongMsg ? `показано: "${wrongMsg.trim()}"` : "сообщения нет",
  !!wrongMsg && wrongMsg.includes("Неверный код")
);
const cookieAfterWrong = (await ctx.cookies()).find((c) => c.name === "oukcion_cabinet_access");
log(
  "S1b Cookie доступа не выдаётся при неверном коде",
  "cookie отсутствует",
  cookieAfterWrong ? "COOKIE ВЫДАНА (дефект)" : "cookie отсутствует",
  !cookieAfterWrong
);
await page.screenshot({ path: `${OUT}/cabinet-01-wrong-code.png` });

// ---------- S2: cabinet blocked without cookie ----------
const blocked = await page.goto(`${BASE}/cabinet/artists`, { waitUntil: "networkidle" }).then(async () =>
  page.locator('input[name="accessCode"]').count()
);
log("S2 Без кода кабинет закрыт", "видна только форма входа", `полей accessCode: ${blocked}`, blocked === 1);

// ---------- S3: correct access code ----------
await page.fill('input[name="accessCode"]', "diag-access-code");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1200);
const cookieAfterGood = (await ctx.cookies()).find((c) => c.name === "oukcion_cabinet_access");
log(
  "S3 Вход с верным кодом выдаёт cookie",
  "cookie oukcion_cabinet_access установлена",
  cookieAfterGood ? "установлена, httpOnly=" + cookieAfterGood.httpOnly + ", sameSite=" + cookieAfterGood.sameSite + ", secure=" + cookieAfterGood.secure : "НЕ УСТАНОВЛЕНА",
  !!cookieAfterGood
);
const cabinetVisible = await page.locator('h1:has-text("Карточка артиста")').count();
log("S3b После входа открыта панель кабинета", "заголовок «Карточка артиста»", cabinetVisible ? "открыта" : "не открыта", cabinetVisible === 1);
await page.screenshot({ path: `${OUT}/cabinet-02-after-login.png`, fullPage: true });

// ---------- S4: save artist ----------
const artistForm = page.locator('form:has(input[name="name"])').first();
await artistForm.locator('input[name="name"]').fill("Тестовый Артист Диагностика");
await artistForm.locator('input[name="category"]').fill("музыкальная группа");
await artistForm.locator('textarea[name="bio"]').fill("Диагностическая карточка артиста.");
await artistForm.locator('input[name="city"]').fill("Москва");
await artistForm.locator('input[name="auction_lots_count"]').fill("3");
await artistForm.locator('input[name="services_count"]').fill("2");
await artistForm.locator('input[name="featured"]').check().catch(() => {});
await artistForm.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
const artistMsg = await page.locator(".formStatus").first().textContent().catch(() => null);
let state1 = await (await fetch("http://localhost:3002/state")).json();
log(
  "S4 Сохранение карточки артиста",
  "запись artists создана в БД",
  artistMsg ? `UI: "${artistMsg.trim()}"` : "нет сообщения",
  state1.artists.length === 1,
  { dbArtists: state1.artists.length, artist: state1.artists[0] }
);

// ---------- S5: product form validation (missing required) ----------
const productForm = page.locator('form.productForm');
const submitDisabled = await productForm.locator('button[type="submit"]').first().isDisabled();
log(
  "S5 Кнопка сохранения товара активна при наличии артиста",
  "кнопка активна",
  submitDisabled ? "DISABLED (дефект)" : "активна",
  !submitDisabled
);

// ---------- S6: save product ----------
await productForm.locator('select[name="artist"]').selectOption({ index: 1 });
await productForm.locator('input[name="title"]').fill("Диагностический винил");
await productForm.locator('input[name="price_rub"]').fill("18500");
await productForm.locator('input[name="quantity"]').fill("2");
await productForm.locator('textarea[name="description"]').fill("Описание диагностического товара.");
await productForm.locator('textarea[name="provenance"]').fill("Из личного архива артиста.");
await productForm.locator('select[name="category"]').selectOption({ label: "Аудио и видеоносители" });
await productForm.locator('select[name="status"]').selectOption("published");
await productForm.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
const prodMsg = await page.locator(".formStatus").last().textContent().catch(() => null);
let state2 = await (await fetch("http://localhost:3002/state")).json();
log(
  "S6 Сохранение товара",
  "запись physical_products создана",
  prodMsg ? `UI: "${prodMsg.trim()}"` : "нет сообщения",
  state2.products.length === 1,
  { dbProducts: state2.products.length, product: state2.products[0] }
);

// ---------- S7: price 0 accepted? ----------
await productForm.locator('select[name="artist"]').selectOption({ index: 1 });
await productForm.locator('input[name="title"]').fill("Нулевая цена");
await productForm.locator('input[name="price_rub"]').fill("0");
await productForm.locator('input[name="quantity"]').fill("1");
await productForm.locator('textarea[name="description"]').fill("Цена 0.");
await productForm.locator('textarea[name="provenance"]').fill("Тест.");
await productForm.locator('select[name="category"]').selectOption({ label: "Печатная продукция" });
await productForm.locator('select[name="status"]').selectOption("published");
await productForm.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
let state3 = await (await fetch("http://localhost:3002/state")).json();
const zeroPrice = state3.products.find((p) => p.title === "Нулевая цена");
log(
  "S7 Товар с ценой 0 принимается к публикации",
  "отклонено (цена > 0)",
  zeroPrice ? `ПРИНЯТО, price_rub=${zeroPrice.price_rub}, status=${zeroPrice.status}` : "отклонено",
  !zeroPrice,
  { severity: zeroPrice ? "P1" : "" }
);

// ---------- S8: negative price ----------
await productForm.locator('select[name="artist"]').selectOption({ index: 1 });
await productForm.locator('input[name="title"]').fill("Отрицательная цена");
await productForm.locator('input[name="price_rub"]').fill("-500");
await productForm.locator('input[name="quantity"]').fill("1");
await productForm.locator('textarea[name="description"]').fill("Цена -500.");
await productForm.locator('textarea[name="provenance"]').fill("Тест.");
await productForm.locator('select[name="category"]').selectOption({ label: "Печатная продукция" });
await productForm.locator('select[name="status"]').selectOption("published");
await productForm.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
let state4 = await (await fetch("http://localhost:3002/state")).json();
const negPrice = state4.products.find((p) => p.title === "Отрицательная цена");
log(
  "S8 Отрицательная цена отклоняется",
  "товар не создан",
  negPrice ? `СОЗДАН, price_rub=${negPrice.price_rub}` : "не создан",
  !negPrice,
  { severity: negPrice ? "P1" : "" }
);

// ---------- S9: delete artist that has products ----------
const delArtistBtn = page.locator('form:has(input[name="slug"]) button.rowDangerButton').first();
await page.on("dialog", (d) => d.accept());
await delArtistBtn.click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(2000);
let state5 = await (await fetch("http://localhost:3002/state")).json();
log(
  "S9 Удаление артиста с товарами заблокировано",
  "артист не удалён, показана ошибка",
  state5.artists.length === 1 ? "артист на месте (корректно)" : `артистов осталось ${state5.artists.length}`,
  state5.artists.length === 1
);

// ---------- S10: published product visible on homepage ----------
await page.goto(`${BASE}/?nc=${Date.now()}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const homeHtml = await page.content();
log(
  "S10 Опубликованный товар появляется на главной",
  "«Диагностический винил» в HTML главной",
  homeHtml.includes("Диагностический винил") ? "присутствует" : "ОТСУТСТВУЕТ",
  homeHtml.includes("Диагностический винил")
);
await page.screenshot({ path: `${OUT}/cabinet-03-homepage-with-db.png`, fullPage: true });

// ---------- S11: service/auction flows exist? ----------
const svcLinks = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")));
log(
  "S11 На главной нет ссылок на карточку товара/услуги/лота",
  "ссылки на детальные страницы отсутствуют (фиктивная витрина)",
  `всего ссылок: ${svcLinks.length}, уникальных href: ${[...new Set(svcLinks)].join(", ")}`,
  ![...new Set(svcLinks)].some((h) => h && (h.includes("product") || h.includes("service") || h.includes("lot") || h.includes("auction")))
);

// ---------- S12: search button inert ----------
const searchBtn = page.locator('button[aria-label="Поиск"]');
const before = await page.content();
await searchBtn.click({ force: true });
await page.waitForTimeout(800);
const after = await page.content();
log(
  "S12 Кнопка поиска выполняет действие",
  "открывается поиск / изменяется DOM",
  before === after ? "DOM НЕ ИЗМЕНИЛСЯ (фиктивная кнопка)" : "DOM изменился",
  before !== after
);

await browser.close();
fs.writeFileSync(
  "/var/folders/bq/dwfnvhjs5h192n4syngj695r0000gn/T/opencode/cabinet-e2e.json",
  JSON.stringify({ results, pageErrors: errors }, null, 2)
);
for (const r of results) {
  console.log(`[${r.status}] ${r.name}\n    ожидалось: ${r.expected}\n    фактически: ${r.actual}`);
}
console.log("\npage errors:", errors);
