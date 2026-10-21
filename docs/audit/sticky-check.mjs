import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ channel: "chrome" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("https://oukcion.vercel.app/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const before = await page.evaluate(async () => {
  const t = document.querySelector(".topbar");
  const main = document.querySelector("main");
  const cs = getComputedStyle(main);
  window.scrollTo(0, 2000);
  await new Promise((r) => setTimeout(r, 500));
  const out = { mainOverflow: cs.overflow, mainHeight: cs.height, mainScrollH: main.scrollHeight, clientH: main.clientHeight,
    topbarTop: Math.round(t.getBoundingClientRect().top), scrollY: Math.round(window.scrollY) };
  // now disable overflow on main and re-test
  main.style.overflow = "visible";
  await new Promise((r) => setTimeout(r, 400));
  out.topbarTopAfterFix = Math.round(t.getBoundingClientRect().top);
  return out;
});
console.log(JSON.stringify(before, null, 1));
await browser.close();
