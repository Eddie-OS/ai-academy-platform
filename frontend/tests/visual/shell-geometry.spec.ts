import { test } from '@playwright/test';
import { PAGE_SHELL, type PageKey } from '../../src/shared/theme/designTokensV2';
import { SHELL_NAV } from '../../src/app/shell/shellNav';
import { expectShellGeometry, openBaseline } from './shell';

/**
 * L0 壳层边界回归（《设计文档 V2.0》1.3）。
 *
 * <p>这一层独立成一个 spec，而不是塞进各页的 spec 里，是因为它验的是<b>双轨机制本身</b>：
 * 九页共用一个 AppShell，逐页差异全靠 {@code data-page} 注入 CSS 变量。这个机制一旦坏掉
 * （比如某页忘了给 pageKey、或者 tokens-v2.css 的选择器写错），表现是「壳层尺寸集体退回产品模式」，
 * 九页的整图像素比对会同时变红，但看不出根因。这里逐页断言侧栏宽度、顶栏高度与正文起点，
 * 报错信息直接给出实测值与文档值。
 *
 * <p>文档 1.3 规定「任何一级边界超过 2px 都不进入颜色和细节验收」，因此本 spec 应先于
 * 各页的 toHaveScreenshot 运行。
 */

const PAGE_PATH = new Map<PageKey, string>(SHELL_NAV.map((item) => [item.pageKey, item.path]));

for (const [pageKey, shell] of Object.entries(PAGE_SHELL) as [PageKey, typeof PAGE_SHELL[PageKey]][]) {
  const path = PAGE_PATH.get(pageKey);
  if (!path) continue;

  test(`${shell.code} ${pageKey} 壳层边界（侧栏 ${shell.sidebarWidth} / 顶栏 ${shell.topbarHeight} / 正文起点 ${shell.contentX}）`, async ({
    page,
  }) => {
    await openBaseline(page, path);
    await expectShellGeometry(page, pageKey);
  });
}
