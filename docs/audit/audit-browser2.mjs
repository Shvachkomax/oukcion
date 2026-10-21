import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";
import fs from "node:fs";

const targets = [
  { name: "local", url: "http://localhost:3001/" },
  { name: "prod", url: "https://oukcion.vercel.app/" },
];

const browser = await chromium.launch({ channel: "chrome" });
const out = {};

for (const t of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ru-RU" });
  const page = await ctx.newPage();
  const bad = [];
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push({ status: r.status(), url: r.url().slice(0, 180) });
  });
  await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);

  // Which resources 404
  const badRes = bad.slice();

  // Font loading check
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].map((f) => `${f.family}:${f.status}`);
    const bodyFam = getComputedStyle(document.body).fontFamily;
    // measure whether DM Sans / Inter actually rendered
    const span = document.createElement("span");
    span.style.font = '16px "DM Sans"';
    span.style.position = "absolute";
    span.textContent = "ПроверкаШрифта";
    document.body.appendChild(span);
    const wDM = span.getBoundingClientRect().width;
    span.style.font = '16px "Inter"';
    const wInter = span.getBoundingClientRect().width;
    span.style.font = '16px monospace';
    const wMono = span.getBoundingClientRect().width;
    span.style.font = '16px sans-serif';
    const wSans = span.getBoundingClientRect().width;
    span.remove();
    return { loaded, bodyFam, wDM, wInter, wMono, wSans, fontsReady: document.fonts.status };
  });

  // Proper interaction test: fresh locator per button
  const interactions = [];
  const count = await page.locator("button").count();
  for (let i = 0; i < count; i++) {
    const label = await page
      .locator("button")
      .nth(i)
      .evaluate((b) => b.textContent.trim().slice(0, 40) + "|" + (b.getAttribute("aria-label") || ""))
      .catch(() => "<?>");
    const before = await page.evaluate(() => ({
      url: location.href,
      html: document.body.innerHTML.length,
      dialogs: document.querySelectorAll('[role="dialog"],dialog,[class*="modal" i],[class*="drawer" i],[class*="sheet" i]').length,
      inputs: document.querySelectorAll("input,textarea,select").length,
      activeTag: document.activeElement?.tagName,
    }));
    let clickErr = null;
    try {
      await page.locator("button").nth(i).click({ timeout: 4000, force: true });
      await page.waitForTimeout(700);
    } catch (e) {
      clickErr = String(e).split("\n")[0].slice(0, 140);
    }
    const after = await page.evaluate(() => ({
      url: location.href,
      html: document.body.innerHTML.length,
      dialogs: document.querySelectorAll('[role="dialog"],dialog,[class*="modal" i],[class*="drawer" i],[class*="sheet" i]').length,
      inputs: document.querySelectorAll("input,textarea,select").length,
      activeTag: document.activeElement?.tagName,
    }));
    interactions.push({
      i,
      label,
      clickErr,
      changed:
        before.url !== after.url ||
        before.html !== after.html ||
        before.dialogs !== after.dialogs ||
        before.inputs !== after.inputs,
      before,
      after,
    });
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // Are cards clickable at all?
  const cardProbe = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        sel,
        cursor: cs.cursor,
        pointerEvents: cs.pointerEvents,
        hasOnclickAttr: el.hasAttribute("onclick"),
        isLink: el.tagName === "A",
        tabIndex: el.getAttribute("tabindex"),
        role: el.getAttribute("role"),
        text: el.textContent.trim().slice(0, 60),
      };
    };
    return [
      pick(".productCard"),
      pick(".serviceItem"),
      pick(".lotCard"),
      pick(".featureLot"),
      pick(".heroPanel"),
    ].filter(Boolean);
  });

  // Anchor link resolution test (do # links scroll correctly?)
  const anchorTest = await page.evaluate(() => {
    const res = [];
    for (const a of document.querySelectorAll('a[href^="#"]')) {
      const id = a.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      res.push({
        href: a.getAttribute("href"),
        exists: !!target,
        targetTag: target?.tagName || null,
        targetText: target?.textContent.trim().slice(0, 40) || null,
        hiddenBehindStickyHeader:
          target ? target.getBoundingClientRect().top < 80 : null,
      });
    }
    return res;
  });

  // Color contrast sampling of key text
  const contrast = await page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const bgOf = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !c.includes("rgba(0, 0, 0, 0)")) return parse(c);
        n = n.parentElement;
      }
      return parse(getComputedStyle(document.body).backgroundColor);
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
    };
    const out = [];
    const sels = ["h1", "h2", "h3", ".nav a", ".primaryButton", ".kicker", ".statusGrid strong", ".statusGrid span", ".cardBody p", ".sectionHead a", ".brand", ".eyebrow", "dt", "dd", ".steps li", ".sellerCopy p"];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (!el) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = bgOf(el);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const r = Number(ratio(fg, bg));
      out.push({ sel: s, fg: cs.color, bg: `rgb(${bg.join(",")})`, size, bold, ratio: r, need, pass: r >= need });
    }
    return out;
  });

  out[t.name] = { badRes, fonts, interactions, cardProbe, anchorTest, contrast };
  await ctx.close();
}

await browser.close();
fs.writeFileSync(
  "/var/folders/bq/dwfnvhjs5h192n4syngj695r0000gn/T/opencode/browser-report2.json",
  JSON.stringify(out, null, 2)
);
console.log("DONE");
for (const [k, v] of Object.entries(out)) {
  console.log(`\n########## ${k} ##########`);
  console.log("HTTP>=400 resources:", JSON.stringify(v.badRes, null, 1));
  console.log("FONTS:", JSON.stringify(v.fonts));
  console.log("INTERACTIONS:", JSON.stringify(v.interactions, null, 1));
  console.log("CARD PROBE:", JSON.stringify(v.cardProbe, null, 1));
  console.log("ANCHORS:", JSON.stringify(v.anchorTest, null, 1));
  console.log("CONTRAST:", JSON.stringify(v.contrast, null, 1));
}
