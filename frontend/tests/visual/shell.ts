import { expect, type Page } from '@playwright/test';
import { PAGE_SHELL, viewportV2, type PageKey } from '../../src/shared/theme/designTokensV2';

/**
 * 九页共用的视觉回归前置动作与壳层断言。
 *
 * <p>《设计文档 V2.0》1.3 把通过条件分成 L0～L5 六级，并规定「任何一级边界超过 2px
 * 都不进入颜色和细节验收」。所以每个 spec 的顺序固定是：先 {@link expectShellGeometry}
 * 校 L0，再 {@link expectRegionGeometry} 校 L1，最后才 toHaveScreenshot 校 L4／L5。
 *
 * <p>顺序不是形式主义：整图像素比对发现不了「侧栏宽 3px、里面所有内容整体右移 3px」——
 * 那种错误的像素差往往仍在 0.75% 阈值内，但页面已经不是设计稿了。
 */

/** 1.3 L0～L2 的统一阈值：每边 ≤2px */
export const BOUNDARY_TOLERANCE = 2;

export interface Region {
  /** 文档各页「区域坐标」表里的编号，如 R3 */
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 打开某一页的视觉回归基线态。
 *
 * <p>文档 1.2 的固定动作：goto(?fixture=1) → 等 fonts.ready → 注入禁用动画的样式。
 * 字体那一步不能省，字体回退会让字宽与基线一起变，L2 必然失败。
 */
export async function openBaseline(page: Page, path: string): Promise<void> {
  const url = path.includes('?') ? `${path}&fixture=1` : `${path}?fixture=1`;
  await page.goto(url);

  // 应用侧也 await 了一次 fonts.ready，这里再等是因为 Playwright 的 goto 在
  // load 事件就返回，此刻字体可能还在解码
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '*{animation:none!important;transition:none!important}',
  });

  // 回归模式必须真的生效。少了这个断言，?fixture=1 拼错时会拿产品模式的截图
  // 去覆盖基线，而且看起来「只是差了一点」
  await expect(page.locator('html')).toHaveAttribute('data-regression', '');
}

/** L0：页面、侧栏、顶部栏、主区域边界 */
export async function expectShellGeometry(page: Page, pageKey: PageKey): Promise<void> {
  const shell = PAGE_SHELL[pageKey];

  const viewport = page.viewportSize();
  expect(viewport, '视口必须是 1586×992（文档 1.1）').toEqual({
    width: viewportV2.width,
    height: viewportV2.height,
  });

  await expectBox(page, '.shell-sidebar', 'R1 左侧导航', {
    x: 0,
    y: 0,
    w: shell.sidebarWidth,
    h: viewportV2.height,
  });

  await expectBox(page, '.shell-topbar', 'R2 顶部栏', {
    x: shell.sidebarWidth,
    y: 0,
    w: viewportV2.width - shell.sidebarWidth,
    h: shell.topbarHeight,
  });

  // 正文起点是相对视口左边缘的绝对坐标，正文基准宽度由 4.1 逐页给出
  const contentLeft = await boundingBox(page, '.shell-content');
  expect(
    Math.abs(contentLeft.x + parseFloat(await paddingLeft(page, '.shell-content')) - shell.contentX),
    `正文起点应为 x=${shell.contentX}（文档 4.1）`,
  ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
}

/** L1：组件框、表格列、卡片、抽屉。逐条比对该页「区域坐标」表 */
export async function expectRegionGeometry(page: Page, regions: Region[]): Promise<void> {
  for (const region of regions) {
    await expectBox(page, `[data-region='${region.id}']`, `${region.id} ${region.name}`, region);
  }
}

/**
 * L1 的补充检查：区域里的内容不得溢出区域自身。
 *
 * <h3>为什么区域坐标断言拦不住这类错</h3>
 *
 * {@link expectRegionGeometry} 量的是<b>区域元素自己</b>的 boundingBox。区域是
 * 固定高度的栅格容器时，它的实测高度永远等于设计值，而里面的卡片完全可以更高 ——
 * 溢出的那部分落到下一个区域上，被后绘制的白底面板盖住，于是<b>内容凭空消失</b>。
 *
 * <p>P01 的入口卡就这样掉过一次：卡片实际 295px 而区域 216px，底部三个统计数
 * 全被下一行的预警面板遮住。九项区域断言、KPI 断言、状态值断言全部通过，
 * 只有肉眼对着截图才发现少了东西。
 *
 * <p>典型成因是 {@code <img>} 在自动高度的栅格行里按自然高度参与最小尺寸计算，
 * {@code flex:1} 压不下去 —— 修法是让栅格行变成确定高度（{@code grid-template-rows: 1fr}）。
 */
export async function expectContentWithinRegions(page: Page, regionIds: string[]): Promise<void> {
  for (const id of regionIds) {
    const overflow = await page.locator(`[data-region='${id}']`).evaluate((region) => {
      const bounds = region.getBoundingClientRect();
      let worst = { tag: '', cls: '', bottom: bounds.bottom, right: bounds.right };
      for (const node of region.querySelectorAll('*')) {
        const box = node.getBoundingClientRect();
        // 跳过不可见元素：它们的矩形是 0×0，位置也没有意义
        if (box.width === 0 && box.height === 0) continue;
        if (box.bottom > worst.bottom || box.right > worst.right) {
          worst = {
            tag: node.tagName.toLowerCase(),
            cls: node.className.toString().slice(0, 60),
            bottom: Math.max(box.bottom, worst.bottom),
            right: Math.max(box.right, worst.right),
          };
        }
      }
      return {
        regionBottom: bounds.bottom,
        regionRight: bounds.right,
        worstBottom: worst.bottom,
        worstRight: worst.right,
        culprit: `${worst.tag}.${worst.cls}`,
      };
    });

    expect(
      overflow.worstBottom - overflow.regionBottom,
      `${id} 里有内容越过区域下沿 ${overflow.regionBottom}（实测到 ${overflow.worstBottom}），元凶 ${overflow.culprit}`,
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    expect(
      overflow.worstRight - overflow.regionRight,
      `${id} 里有内容越过区域右沿 ${overflow.regionRight}（实测到 ${overflow.worstRight}），元凶 ${overflow.culprit}`,
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  }
}

/**
 * 打开「冻结数据 + 产品模式布局」的组合态。
 *
 * <p>数据仍走 fixtures（{@code ?fixture=1} 已被 isRegressionMode 缓存），
 * 但把 {@code <html>} 上的 {@code data-regression} 摘掉，于是壳层不再锁在 1586×992、
 * 页面的按比例伸缩规则（{@code html:not([data-regression])} 那一批）开始生效。
 *
 * <p>这是唯一能在没有后端的情况下验证产品模式几何的办法。产品模式本身要真实接口，
 * 而按比例伸缩恰恰是<b>只在产品模式生效</b>的那部分 CSS —— 不这样测就完全没有回归保护。
 */
export async function openFluid(page: Page, path: string): Promise<void> {
  await openBaseline(page, path);
  await page.evaluate(() => document.documentElement.removeAttribute('data-regression'));
  await expect(page.locator('html')).not.toHaveAttribute('data-regression', '');
}

/**
 * 产品模式下同一页的各条横带必须都到正文右边界，最后一行必须到视口底部附近。
 *
 * <h3>这条断言防的是什么</h3>
 *
 * 设计稿的几何是像素值，照抄成 CSS 后窗口一变宽，多出来的空间不会消失，
 * 而是被布局引擎<b>分给某一个能伸缩的元素</b>：写了 {@code flex:1} 的那一格独自变宽，
 * 宽度写死的那一行原地不动。结果是同一页里一部分横带到边、一部分停在设计宽度，
 * 右边露出几百像素空底 —— 看起来像页面没加载完，而没有任何一条现有断言会失败
 * （区域坐标断言只在 1586 的固定视口下跑，那里根本没有多余空间）。
 *
 * <p>纵向同理：横带高度写死时窗口下方空一大片；而给横带 {@code flex-grow} 时，
 * 若 basis 取 auto，插画的自然高度会污染分配基准，把最后一行顶出视口。
 */
export async function expectFluidFill(
  page: Page,
  rowSelectors: string[],
  options: { bottomSlack: number } = { bottomSlack: 40 },
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('取不到视口尺寸');

  const rights: Array<{ selector: string; right: number }> = [];
  for (const selector of rowSelectors) {
    const box = await boundingBox(page, selector);
    rights.push({ selector, right: box.x + box.width });
  }

  const widest = Math.max(...rights.map((row) => row.right));
  for (const row of rights) {
    expect(
      widest - row.right,
      `${row.selector} 的右沿 ${row.right} 比最宽的横带短 ${widest - row.right}px —— ` +
        '它的宽度大概是写死的像素值，没有跟着窗口一起变宽',
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  }

  const last = await boundingBox(page, rowSelectors[rowSelectors.length - 1]!);
  const gap = viewport.height - (last.y + last.height);
  expect(
    gap,
    `最后一条横带的底沿离视口底部还有 ${gap}px，下方空出一片；` +
      '横带应按设计稿行高的比例分掉整个窗口高度',
  ).toBeLessThanOrEqual(options.bottomSlack);
  expect(gap, `最后一条横带越过了视口底部 ${-gap}px`).toBeGreaterThanOrEqual(-BOUNDARY_TOLERANCE);
}

async function expectBox(
  page: Page,
  selector: string,
  label: string,
  expected: { x: number; y: number; w: number; h: number },
): Promise<void> {
  const box = await boundingBox(page, selector);
  const diffs = {
    x: Math.abs(box.x - expected.x),
    y: Math.abs(box.y - expected.y),
    w: Math.abs(box.width - expected.w),
    h: Math.abs(box.height - expected.h),
  };
  expect(
    Math.max(diffs.x, diffs.y, diffs.w, diffs.h),
    `${label} 实测 ${box.x},${box.y} ${box.width}×${box.height}，` +
      `应为 ${expected.x},${expected.y} ${expected.w}×${expected.h}`,
  ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
}

async function boundingBox(page: Page, selector: string) {
  const locator = page.locator(selector);
  await expect(locator, `选择器 ${selector} 应存在`).toHaveCount(1);
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${selector} 不可见，取不到 boundingBox`);
  return box;
}

async function paddingLeft(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((el) => getComputedStyle(el).paddingLeft);
}
