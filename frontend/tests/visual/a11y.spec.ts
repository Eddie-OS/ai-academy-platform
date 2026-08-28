import { expect, test, type Page } from '@playwright/test';
import { SHELL_NAV, PAGE_TITLE, APP_NAME } from '../../src/app/shell/shellNav';
import { openBaseline } from './shell';

/**
 * 无障碍结构走查的自动化部分（出口准则 E5-2，走查表 A11Y-08／10～12／27／29／30）。
 *
 * <h3>为什么这些项值得自动化，而 200% 缩放那些不值得</h3>
 *
 * 这里跑的每一条都有<b>客观判据</b>：标题是否为空、地标有几个、焦点环宽几像素、
 * 目标框多少像素。人眼看这些既慢又不可靠，而且看过一次不会自动再看第二次——
 * 走查表上原来那些手填的 ☐ 正是这么来的。
 *
 * <p>留给人工的是另一类：灰度下能否区分（A11Y-04）、缩放到 200% 是否还能用（A11Y-07）、
 * 浏览器兼容矩阵。它们要么需要判断，要么与「min-width:1440px、<1440 不适配」这条
 * 已生效的产品决定直接冲突，自动化断言只会变成一条永远为假的红灯。
 */

/** 未获焦点时被 clip 成 1×1 的跳过导航链接。它不是真的小目标，量尺寸时要排掉 */
const SKIP_LINK = '.shell-skip-link';

const CLICKABLE = 'button, a[href], [role="button"], input, select, textarea';

interface Facts {
  title: string;
  lang: string;
  mainCount: number;
  imgTotal: number;
  imgWithoutAlt: number;
  tablesWithoutThead: number;
  smallTargets: number;
  smallSamples: string[];
}

async function collect(page: Page): Promise<Facts> {
  return page.evaluate(
    ({ clickable, skipLink }) => {
      const images = Array.from(document.querySelectorAll('img'));
      const tables = Array.from(document.querySelectorAll('table'));
      const targets = Array.from(document.querySelectorAll(clickable)).filter(
        (el) => !el.closest(skipLink),
      );
      const small = targets
        .map((el) => {
          const box = el.getBoundingClientRect();
          return {
            label: `${el.tagName.toLowerCase()}「${(el.textContent ?? '').trim().slice(0, 10)}」${Math.round(box.width)}×${Math.round(box.height)}`,
            width: box.width,
            height: box.height,
          };
        })
        // 完全不可见的元素（0×0）不是目标，折叠的页签内容都在这一类里
        .filter((t) => (t.width > 0 || t.height > 0) && (t.width < 24 || t.height < 24));

      return {
        title: document.title,
        lang: document.documentElement.lang,
        mainCount: document.querySelectorAll('main').length,
        imgTotal: images.length,
        imgWithoutAlt: images.filter((img) => !img.hasAttribute('alt')).length,
        tablesWithoutThead: tables.filter((t) => !t.querySelector('thead')).length,
        smallTargets: small.length,
        smallSamples: small.slice(0, 5).map((t) => t.label),
      };
    },
    { clickable: CLICKABLE, skipLink: SKIP_LINK },
  );
}

/**
 * SC 2.5.8 目标尺寸（最小）24×24 —— **已知未达标，这里是棘轮而不是通过线**。
 *
 * <p>不达标的来源是 AntD 的 {@code size="small"} 文字按钮（26×19）、表格勾选框（13×13）
 * 与日历里的场次条（105×12）。改这些等于重画九页的视觉基线，超出阶段 5「不加新功能、
 * 只修缺陷」的范围，因此按 V-4／V-5 的先例登记为待裁决项（走查表 A11Y-15）。
 *
 * <p>下面这组数是 2026-08-04 的实测值。断言用 ≤ 而不是 ==：
 * 修好一批不会让测试变红，<b>新增一个会</b>。走查表上那句「☐ 待人工抽查」做不到这件事。
 */
const SMALL_TARGET_BASELINE: Record<string, number> = {
  '/': 8,
  '/demands': 12,
  '/courses': 4,
  '/lecturers': 12,
  '/trainings': 22,
  '/cases': 2,
  '/tasks': 12,
  '/escalations': 2,
  '/reviews': 20,
};

for (const item of SHELL_NAV) {
  test(`${item.label} 无障碍结构（标题／地标／alt／表头／目标尺寸）`, async ({ page }) => {
    await openBaseline(page, item.path);
    const facts = await collect(page);

    // SC 2.4.2：标题要能区分是哪一页，不能九页共用一个平台名
    expect(facts.title, 'document.title 应为「页名 · 平台名」').toBe(
      `${PAGE_TITLE[item.pageKey]} · ${APP_NAME}`,
    );

    // SC 3.1.1
    expect(facts.lang).toBe('zh-CN');

    // SC 1.3.1：主区地标唯一。页面内再套一个 <main> 会让屏幕阅读器的「跳到主内容」失去意义
    expect(facts.mainCount, '整页只能有一个 <main>').toBe(1);

    // SC 1.1.1：装饰图用 alt=""，但属性本身必须在
    expect(facts.imgWithoutAlt, `${facts.imgTotal} 张图里有缺 alt 属性的`).toBe(0);

    // SC 1.3.1：表头行要在 <thead> 里，否则表格读起来是一片无标题的单元格
    expect(facts.tablesWithoutThead).toBe(0);

    expect(
      facts.smallTargets,
      `小于 24×24 的目标增加了（A11Y-15 待裁决项）。样例：${facts.smallSamples.join('；')}`,
    ).toBeLessThanOrEqual(SMALL_TARGET_BASELINE[item.path] ?? 0);
  });
}

test('A11Y-30 跳过导航：Tab 第一站就是它，回车后焦点落到主区（SC 2.4.1）', async ({ page }) => {
  await openBaseline(page, '/');

  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => ({
    className: document.activeElement?.className ?? '',
    text: document.activeElement?.textContent ?? '',
  }));
  expect(first.className, '第一个可聚焦元素应是跳过导航链接').toContain('shell-skip-link');
  expect(first.text).toBe('跳至主内容');

  // 获得焦点后必须真的看得见：视觉上不出现的跳过链接等于没做
  const box = await page.locator(SKIP_LINK).boundingBox();
  expect(box, '聚焦后跳过链接应可见').not.toBeNull();
  expect(box!.height, '聚焦后的跳过链接应达到 24px 目标尺寸').toBeGreaterThanOrEqual(24);

  await page.keyboard.press('Enter');
  const landed = await page.evaluate(() => document.activeElement?.id ?? '');
  expect(landed, '回车后焦点应落在主区上，否则下一次 Tab 又回到侧栏').toBe('shell-content');
});

test('A11Y-12 焦点环可见：侧栏项获得焦点后有 ≥2px 实线轮廓（SC 2.4.7）', async ({ page }) => {
  await openBaseline(page, '/');

  // 第一次 Tab 是跳过导航，第二次才进侧栏
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      text: (el.textContent ?? '').trim(),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
    };
  });

  expect(focus?.text).toBe('总看板');
  expect(focus?.outlineStyle, '焦点环不能是 none —— 去掉轮廓是键盘不可用的头号原因').toBe('solid');
  expect(focus?.outlineWidth).toBeGreaterThanOrEqual(2);
  // 对比度 3.45:1 由 src/shared/theme/contrast.test.ts 单独断言，这里只认颜色是品牌识别色
  expect(focus?.outlineColor).toBe('rgb(91, 130, 255)');
});

test('A11Y-10 键盘可达：连续 Tab 能走遍侧栏 11 项而不被卡住（SC 2.1.1）', async ({ page }) => {
  await openBaseline(page, '/');

  const visited: string[] = [];
  // 侧栏 9 项 + 导入 + 配置 = 11 项，前面还有一个跳过导航
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    visited.push(
      await page.evaluate(() => (document.activeElement?.textContent ?? '').trim().slice(0, 20)),
    );
  }

  for (const nav of SHELL_NAV) {
    expect(visited.join('|'), `侧栏「${nav.label}」应能用 Tab 到达`).toContain(nav.label);
  }
});
