import { chromium } from "/Users/macintosh/Documents/GitHub/Tochka-Opori/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ channel: "chrome" });

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
  await page.goto("https://oukcion.vercel.app/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // sticky header height after scrolling
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(600);
  const sticky = await page.evaluate(() => {
    const t = document.querySelector(".topbar");
    const r = t.getBoundingClientRect();
    return {
      position: getComputedStyle(t).position,
      top: Math.round(r.top),
      height: Math.round(r.height),
      viewportH: window.innerHeight,
      pctOfViewport: Math.round((r.height / window.innerHeight) * 100),
      coversContent: r.height > window.innerHeight * 0.15,
    };
  });

  // focus ring visibility across the tab order
  const focusRings = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28),
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        outlineColor: s.outlineColor,
        boxShadow: s.boxShadow === "none" ? "none" : s.boxShadow.slice(0, 40),
        visible: r.width > 0 && r.height > 0,
      };
    });
    if (f) focusRings.push(f);
  }

  // misleading links
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("a")].map((a) => ({
      text: a.textContent.trim().slice(0, 40),
      href: a.getAttribute("href"),
      targetText: a.getAttribute("href")?.startsWith("#")
        ? document.querySelector(a.getAttribute("href"))?.textContent.trim().slice(0, 45)
        : null,
    }))
  );

  // alt text / images
  const imgs = await page.evaluate(() => ({
    img: document.querySelectorAll("img").length,
    roleImg: document.querySelectorAll('[role="img"]').length,
    ariaLabelOnBg: [...document.querySelectorAll("[aria-label]")].map((e) => ({
      cls: String(e.className).slice(0, 30),
      label: e.getAttribute("aria-label"),
    })),
    backgroundImages: [...document.querySelectorAll("*")]
      .filter((e) => getComputedStyle(e).backgroundImage.includes("url("))
      .slice(0, 10)
      .map((e) => ({
        cls: String(e.className).slice(0, 40),
        bg: getComputedStyle(e).backgroundImage.slice(0, 90),
        hasAltText: !!e.querySelector("span")?.textContent.trim(),
        spanText: e.querySelector("span")?.textContent.trim().slice(0, 30),
      })),
  }));

  console.log(`\n########## ${vp.name} ##########`);
  console.log("sticky header:", JSON.stringify(sticky));
  console.log("focus rings:");
  for (const f of focusRings) console.log("   ", JSON.stringify(f));
  console.log("links:");
  for (const l of links) console.log("   ", JSON.stringify(l));
  console.log("images:", JSON.stringify(imgs, null, 1));

  await ctx.close();
}
await browser.close();
