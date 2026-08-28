/**
 * 产品模式截图。视觉回归基线走 1586×992 的固定壳层，产品模式是流式布局，
 * 两者的字号与留白必须分别看——用回归截图判断产品模式的观感一定会看错。
 *
 * 用法：node scripts/shot-product.mjs [路径] [宽] [高]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const path = process.argv[2] ?? '/cases';
const width = Number(process.argv[3] ?? 1920);
const height = Number(process.argv[4] ?? 1080);
const out = 'shots';

mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  reducedMotion: 'reduce',
});

// 只有 dev server（5173）代理 /api，preview 没有代理，产品模式在 4173 上会停在登录页
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173';
await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });

const login = page.locator('input[type="password"]');
if (await login.count()) {
  await page.getByPlaceholder('运营账号或用户账号').fill('operator');
  await login.fill('operator123');
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15_000 }).catch(() => {});
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
}

await page.waitForTimeout(800);

const name = `${path.replace(/[^a-z0-9]+/gi, '_') || 'root'}-${width}x${height}.png`;
await page.screenshot({ path: `${out}/${name}` });
console.log(`${out}/${name}`);

await browser.close();
