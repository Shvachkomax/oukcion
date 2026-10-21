import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
import fs from "node:fs";

const OUT = "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/screenshots";
const browser = await chromium.launch({ channel: "chrome" });
const report = {};

const cases = [
  { name: "prod-cabinet", url: "https://oukcion.vercel.app/cabinet/artists" },
  { name: "prod-home", url: "https://oukcion.vercel.app/" },
  { name: "local-mock-home", url: "http://localhost:3100/" },
  { name: "local-mock-cabinet", url: "http://localhost:3100/cabinet/artists" },
];

for (const c of cases) {
  report[c.name] = {};
  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
      locale: "ru-RU",
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 150)));
    const resp = await page.goto(c.url, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => ({ err: String(e).slice(0, 100) }));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${c.name}-${vp.name}.png`, fullPage: true });

    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const nav = document.querySelector("nav");
      const navRect = nav?.getBoundingClientRect();
      // is the nav visible / wrapping on mobile?
      const navLinks = [...(nav?.querySelectorAll("a") || [])].map((a) => ({
        t: a.textContent.trim(),
        visible: a.getBoundingClientRect().width > 0,
        y: Math.round(a.getBoundingClientRect().top),
      }));
      // topbar layout
      const top = document.querySelector(".topbar");
      const topRect = top?.getBoundingClientRect();
      // any element overflowing horizontally
      const overflowers = [...document.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1)
        .slice(0, 10)
        .map((el) => ({ cls: String(el.className).slice(0, 50), tag: el.tagName, right: Math.round(el.getBoundingClientRect().right) }));
      // tap targets < 44px (mobile) / < 32 (desktop)
      const small = [...document.querySelectorAll("a,button,input,select,textarea")]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => ({ t: (el.textContent || el.getAttribute("aria-label") || el.getAttribute("name") || el.tagName).trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) }))
        .filter((x) => x.h > 0 && x.h < 32);
      // focus visible on first tab
      return {
        hScroll: de.scrollWidth - de.clientWidth,
        overflowers,
        navLinks,
        navTop: navRect ? Math.round(navRect.top) : null,
        navHeight: navRect ? Math.round(navRect.height) : null,
        topbarHeight: topRect ? Math.round(topRect.height) : null,
        small,
        inputs: document.querySelectorAll("input,textarea,select").length,
        forms: document.querySelectorAll("form").length,
        buttons: document.querySelectorAll("button").length,
        links: document.querySelectorAll("a").length,
        h1: document.querySelector("h1")?.textContent.trim() || null,
        bodyFont: getComputedStyle(document.body).fontFamily.split(",")[0],
        bodyBg: getComputedStyle(document.body).backgroundColor,
        docHeight: de.scrollHeight,
      };
    });

    // keyboard tab through all focusables, check focus ring visibility
    const focusables = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')];
      return els.length;
    });

    report[c.name][vp.name] = { status: resp?.status?.() ?? resp, errs, focusables, ...info };
    await ctx.close();
  }
}

await browser.close();
fs.writeFileSync("/var/folders/bq/dwfnvhjs5h192n4syngj695r0000gn/T/opencode/browser-report3.json", JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(report)) {
  for (const [k2, v2] of Object.entries(v)) {
    console.log(`\n=== ${k} / ${k2} ===`);
    console.log(`  status=${v2.status} hScroll=${v2.hScroll} docHeight=${v2.docHeight} bg=${v2.bodyBg} font=${v2.bodyFont}`);
    console.log(`  h1=${JSON.stringify(v2.h1)} links=${v2.links} buttons=${v2.buttons} inputs=${v2.inputs} forms=${v2.forms} focusables=${v2.focusables}`);
    console.log(`  navTop=${v2.navTop} navH=${v2.navHeight} topbarH=${v2.topbarHeight}`);
    console.log(`  navLinks=${JSON.stringify(v2.navLinks)}`);
    console.log(`  overflowers=${JSON.stringify(v2.overflowers)}`);
    console.log(`  smallTargets=${JSON.stringify(v2.small.slice(0, 12))}`);
    console.log(`  errors=${JSON.stringify(v2.errs)}`);
  }
}
