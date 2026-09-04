import { chromium } from '@playwright/test';

const base = process.env.SHOT_BASE ?? 'http://localhost:5173';

// 口令无默认值：仓库里不留口令字面量。本地填 .env 里的 LOCAL_OPERATOR_PASSWORD。
const password = process.env.SMOKE_OPERATOR_PASSWORD;
if (!password) {
  throw new Error('请先设置 SMOKE_OPERATOR_PASSWORD（本地即 .env 里的 LOCAL_OPERATOR_PASSWORD）');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN' });

await page.goto(`${base}/cases`, { waitUntil: 'networkidle' });
if (await page.locator('input[type="password"]').count()) {
  await page.getByPlaceholder('运营账号或用户账号').fill('operator');
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForTimeout(1500);
  await page.goto(`${base}/cases`, { waitUntil: 'networkidle' });
}
await page.waitForTimeout(500);

for (const zoom of [1, 1.21]) {
  await page.evaluate((z) => {
    document.documentElement.style.zoom = String(z);
  }, zoom);
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const shell = document.querySelector('.shell');
    const content = document.querySelector('.shell-content');
    const rect = shell.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector('.shell-content'));
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      shell: { w: Math.round(rect.width), h: Math.round(rect.height) },
      content: { w: Math.round(contentRect.width), h: Math.round(contentRect.height) },
      contentOverflowY: content.scrollHeight - content.clientHeight,
      fontSizeContent: cs.fontSize,
    };
  });
  console.log(zoom, JSON.stringify(info));
}

await page.evaluate(() => {
  document.documentElement.style.zoom = '1.21';
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/_cases-zoom121.png' });
await browser.close();
