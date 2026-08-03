import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1586, height: 992 } });
await page.goto('http://127.0.0.1:4173/cases?fixture=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const regions = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    sidebar: pick('.shell-sidebar'),
    kpis: pick("[data-region='R3']"),
    filters: pick("[data-region='R4']"),
    library: pick("[data-region='R5']"),
    analytics: pick("[data-region='R6']"),
    coverage: pick("[data-region='R7']"),
    detail: pick("[data-region='R8']"),
    main: pick('.cse-main'),
    left: pick('.cse-left'),
    card: pick("[data-testid='case-card']"),
    cardCover: pick('.cse-card-cover'),
    content: pick('.shell-content'),
  };
});

console.log(JSON.stringify(regions, null, 2));

// Expected from V2.0
const expected = {
  kpis: { x: 215, y: 74, w: 1335, h: 90 },
  filters: { x: 215, y: 176, w: 1335, h: 57 },
  library: { x: 215, y: 243, w: 985, h: 265 },
  analytics: { x: 215, y: 522, w: 985, h: 170 },
  coverage: { x: 215, y: 703, w: 985, h: 251 },
  detail: { x: 1215, y: 243, w: 336, h: 711 },
};

for (const [key, exp] of Object.entries(expected)) {
  const act = regions[key];
  if (!act) {
    console.log(`${key}: MISSING`);
    continue;
  }
  console.log(
    `${key}: dx=${act.x - exp.x} dy=${act.y - exp.y} dw=${act.w - exp.w} dh=${act.h - exp.h} | act=${JSON.stringify(act)}`,
  );
}

await browser.close();
