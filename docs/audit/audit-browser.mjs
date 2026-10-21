import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
import fs from "node:fs";

const OUT = "/Users/macintosh/Documents/GitHub/Ouction/Ouction/docs/audit/screenshots";
const targets = [
  { name: "local", url: "http://localhost:3001/" },
  { name: "prod", url: "https://oukcion.vercel.app/" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

const report = {};

const browser = await chromium.launch({ channel: "chrome" });

for (const t of targets) {
  report[t.name] = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
      deviceScaleFactor: vp.deviceScaleFactor || 1,
      locale: "ru-RU",
    });
    const page = await ctx.newPage();
    const consoleMsgs = [];
    const pageErrors = [];
    const failedReqs = [];
    page.on("console", (m) => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 300) }));
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on("requestfailed", (r) =>
      failedReqs.push({ url: r.url().slice(0, 200), err: r.failure()?.errorText })
    );

    let resp = null;
    try {
      resp = await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 });
    } catch (e) {
      report[t.name][vp.name] = { gotoError: String(e).slice(0, 300) };
      await ctx.close();
      continue;
    }

    await page.waitForTimeout(1200);

    // Full page screenshot
    const file = `${OUT}/${t.name}-${vp.name}-full.png`;
    try {
      await page.screenshot({ path: file, fullPage: true });
    } catch (e) {
      report[t.name][vp.name].shotError = String(e).slice(0, 200);
    }

    // Viewport screenshot
    const file2 = `${OUT}/${t.name}-${vp.name}-viewport.png`;
    try {
      await page.screenshot({ path: file2, fullPage: false });
    } catch (e) {}

    // Inventory of interactive elements
    const inventory = await page.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const links = [...document.querySelectorAll("a")].map((a) => ({
        text: a.textContent.trim().slice(0, 60),
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        visible: vis(a),
      }));
      const buttons = [...document.querySelectorAll("button")].map((b) => ({
        text: b.textContent.trim().slice(0, 60),
        aria: b.getAttribute("aria-label"),
        type: b.getAttribute("type"),
        visible: vis(b),
        disabled: b.disabled,
      }));
      const inputs = [...document.querySelectorAll("input,textarea,select")].map((i) => ({
        tag: i.tagName,
        name: i.getAttribute("name"),
        type: i.getAttribute("type"),
        placeholder: i.getAttribute("placeholder"),
        visible: vis(i),
      }));
      const forms = document.querySelectorAll("form").length;
      const imgs = [...document.querySelectorAll("img")].map((i) => ({
        src: i.getAttribute("src"),
        alt: i.getAttribute("alt"),
        w: i.getBoundingClientRect().width,
        h: i.getBoundingClientRect().height,
      }));
      const sections = [...document.querySelectorAll("section,main>div")].map((s) => ({
        cls: s.className,
        id: s.id,
      }));
      // horizontal overflow check
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      // elements wider than viewport
      const wide = [...document.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().width > de.clientWidth + 2)
        .slice(0, 12)
        .map((el) => ({
          cls: String(el.className).slice(0, 70),
          tag: el.tagName,
          w: Math.round(el.getBoundingClientRect().width),
        }));
      // tiny tap targets on mobile
      const smallTargets = [...document.querySelectorAll("a,button,input")]
        .filter((el) => vis(el))
        .map((el) => ({ t: el.textContent.trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter((x) => x.r.height > 0 && x.r.height < 40)
        .map((x) => ({ t: x.t, h: Math.round(x.r.height), w: Math.round(x.r.width) }));
      return {
        links,
        buttons,
        inputs,
        forms,
        imgs,
        sections,
        overflow,
        wide,
        smallTargets,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyFont: getComputedStyle(document.body).fontFamily,
        h1Font: document.querySelector("h1")
          ? getComputedStyle(document.querySelector("h1")).fontFamily
          : null,
        title: document.title,
        lang: document.documentElement.lang,
        metaViewport: document.querySelector('meta[name="viewport"]')?.content || null,
        h1s: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
        headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.tagName + ":" + h.textContent.trim().slice(0, 50)),
        imgCount: document.querySelectorAll("img").length,
        svgs: document.querySelectorAll("svg").length,
      };
    });

    // Interaction probes: click every button and check for side effects
    const interactions = [];
    const btns = await page.$$("button");
    const btnLabels = [];
    for (const b of btns) {
      btnLabels.push(
        await b
          .evaluate((b) => b.textContent.trim().slice(0, 40) + "|" + (b.getAttribute("aria-label") || ""))
          .catch(() => "<?>")
      );
    }
    for (let i = 0; i < btns.length; i++) {
      const before = await page.evaluate(() => ({
        url: location.href,
        html: document.body.innerHTML.length,
        modals: document.querySelectorAll('[role="dialog"],dialog,[class*="modal"],[class*="Modal"]').length,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }));
      let err = null;
      try {
        await btns[i].click({ timeout: 3000 });
        await page.waitForTimeout(500);
      } catch (e) {
        err = String(e).split("\n")[0].slice(0, 120);
      }
      const after = await page.evaluate(() => ({
        url: location.href,
        html: document.body.innerHTML.length,
        modals: document.querySelectorAll('[role="dialog"],dialog,[class*="modal"],[class*="Modal"]').length,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }));
      interactions.push({
        idx: i,
        label: btnLabels[i],
        clickError: err,
        urlChanged: before.url !== after.url,
        htmlChanged: before.html !== after.html,
        modalBefore: before.modals,
        modalAfter: after.modals,
        overflowChanged: before.bodyOverflow !== after.bodyOverflow,
      });
      await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(400);
    }

    // Keyboard accessibility: tab through, count focusables and check visible focus ring
    await page.keyboard.press("Tab");
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 40),
        outline: s.outline,
        outlineWidth: s.outlineWidth,
        boxShadow: s.boxShadow.slice(0, 60),
        hasFocusStyle: s.outlineStyle !== "none" || s.boxShadow !== "none",
      };
    });

    // Anchor targets exist?
    const anchorCheck = await page.evaluate(() => {
      return [...document.querySelectorAll('a[href^="#"]')].map((a) => ({
        href: a.getAttribute("href"),
        targetExists: !!document.querySelector(a.getAttribute("href")),
      }));
    });

    report[t.name][vp.name] = {
      httpStatus: resp?.status(),
      finalUrl: page.url(),
      inventory,
      interactions,
      focusInfo,
      anchorCheck,
      consoleMsgs,
      pageErrors,
      failedReqs,
    };
    await ctx.close();
  }
}

await browser.close();
fs.writeFileSync(
  "/var/folders/bq/dwfnvhjs5h192n4syngj695r0000gn/T/opencode/browser-report.json",
  JSON.stringify(report, null, 2)
);
console.log("DONE");
for (const [k, v] of Object.entries(report)) {
  for (const [k2, v2] of Object.entries(v)) {
    if (v2?.inventory) {
      console.log(
        k,
        k2,
        JSON.stringify({
          overflow: v2.inventory.overflow,
          links: v2.inventory.links.length,
          buttons: v2.inventory.buttons.length,
          inputs: v2.inventory.inputs.length,
          forms: v2.inventory.forms,
          imgs: v2.inventory.imgs.length,
          h1s: v2.inventory.h1s,
          errors: v2.pageErrors.length,
          failed: v2.failedReqs.length,
        })
      );
    } else {
      console.log(k, k2, JSON.stringify(v2));
    }
  }
}
