import { expect, test } from '@playwright/test';
import {
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

/**
 * P06 案例与组织覆盖视觉回归（《设计文档 V2.0》第 10 章）。
 *
 * <p>几何之外钉住：浏览次数改名、待审核合法态、圆环无分享扇区、
 * 新建／分享按钮 disabled、六 KPI + R7 两种模式都在（V-65）、卡片等宽铺满、部门表 480px。
 */

const REGIONS: Region[] = [
  { id: 'R3', name: '六张 KPI', x: 215, y: 74, w: 1335, h: 90 },
  { id: 'R4', name: '筛选器', x: 215, y: 176, w: 1335, h: 57 },
  { id: 'R5', name: '案例库', x: 215, y: 243, w: 985, h: 265 },
  { id: 'R6', name: '案例分析', x: 215, y: 522, w: 985, h: 170 },
  { id: 'R7', name: '组织覆盖', x: 215, y: 703, w: 985, h: 251 },
  { id: 'R8', name: '案例详情', x: 1215, y: 243, w: 336, h: 711 },
];

const KPIS = [
  { id: 'total', label: '案例总数', value: '1,268' },
  { id: 'published', label: '已上架案例数', value: '986' },
  { id: 'views', label: '浏览次数', value: '128,358' },
  { id: 'likes', label: '点赞量', value: '6,842' },
  { id: 'comments', label: '评论数', value: '1,236' },
  { id: 'coveredDepts', label: '已覆盖部门数', value: '68' },
];

const COVERAGE_COLUMNS = [
  { id: 'dept', label: '部门', width: 210 },
  { id: 'headcount', label: '在职', width: 90 },
  { id: 'trained', label: '已培训', width: 90 },
  { id: 'rate', label: '渗透率', width: 90 },
];

test.describe('P06 案例与组织覆盖', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/cases');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'case');
  });

  test('L1 六区域外框（含组织覆盖）', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 六区域内容不溢出区域', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  /*
   * 卡宽不再钉 177：5×177 + 4×12 = 933，比案例库净宽 959 短 26px，右边留一条白边。
   * 设计稿标的 177 是 1440 基准下的换算值，铺满才是它想表达的版式，
   * 所以这里改钉「等宽 + 间距 12 + 左右沿贴住案例库」——间距 12 仍是照抄值。
   */
  test('L1 五张案例卡等宽铺满案例库、间距 12', async ({ page }) => {
    const cards = page.getByTestId('case-card');
    await expect(cards).toHaveCount(5);
    const boxes = await cards.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = (node as HTMLElement).getBoundingClientRect();
        return { x: rect.x, w: rect.width };
      }),
    );
    for (const box of boxes) {
      expect(Math.abs(box.w - boxes[0]!.w), '五张卡等宽').toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < boxes.length; i += 1) {
      const gap = boxes[i]!.x - (boxes[i - 1]!.x + boxes[i - 1]!.w);
      expect(Math.abs(gap - 12), `卡 ${i - 1}→${i} 间距`).toBeLessThanOrEqual(2);
    }

    const strip = await page.getByTestId('case-cards').boundingBox();
    expect(strip).toBeTruthy();
    expect(Math.abs(boxes[0]!.x - strip!.x), '首卡左沿').toBeLessThanOrEqual(2);
    const lastRight = boxes[4]!.x + boxes[4]!.w;
    expect(Math.abs(lastRight - (strip!.x + strip!.width)), '末卡右沿').toBeLessThanOrEqual(2);
  });

  test('L1 部门详情四列合计 480', async ({ page }) => {
    const widths = await page.locator('.cse-coverage-table col').evaluateAll((cols) =>
      cols.map((col) => Math.round((col as HTMLElement).getBoundingClientRect().width)),
    );
    expect(widths).toHaveLength(4);
    COVERAGE_COLUMNS.forEach((column, index) => {
      expect(Math.abs(widths[index]! - column.width), column.label).toBeLessThanOrEqual(2);
    });
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(480);
  });

  test('L2 六张 KPI，第三张叫浏览次数不是阅读量', async ({ page }) => {
    for (const kpi of KPIS) {
      const card = page.locator(`[data-testid='case-kpi'][data-kpi='${kpi.id}']`);
      await expect(card.locator('.cse-kpi-label')).toHaveText(kpi.label);
      await expect(card.locator('.cse-kpi-value')).toHaveText(kpi.value);
    }
    await expect(page.getByText('阅读量', { exact: true })).toHaveCount(0);
  });

  test('L2 案例状态只有合法四值，不出现审核中', async ({ page }) => {
    const states = await page.locator('[data-testid="case-state"]').allTextContents();
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      expect(['待整理', '整理中', '待审核', '已上架']).toContain(state.trim());
    }
    await expect(page.getByText('审核中', { exact: true })).toHaveCount(0);
  });

  test('L2 新建案例禁用；有生成总结报告', async ({ page }) => {
    await expect(page.getByRole('button', { name: '新建案例' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '生成总结报告' })).toBeVisible();
  });

  test('L2 互动圆环只有点赞与评论，没有分享扇区', async ({ page }) => {
    const donut = page.getByTestId('interaction-donut');
    await expect(donut).toContainText('点赞');
    await expect(donut).toContainText('评论');
    await expect(donut).toContainText('84.7%');
    await expect(donut).toContainText('15.3%');
    await expect(donut).not.toContainText('分享');
  });

  test('L2 详情默认案例与报告动作：更新／下载可用，分享禁用', async ({ page }) => {
    await expect(page.getByTestId('detail-title')).toHaveText('AI助力智能合同审查');
    await expect(page.getByTestId('case-report')).toContainText('2024-06-10 09:30');
    await expect(page.getByRole('button', { name: '更新报告' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '下载报告' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '分享报告' })).toBeDisabled();
  });

  test('L2 卡片／列表切换会重排', async ({ page }) => {
    await expect(page.getByTestId('case-cards')).toBeVisible();
    await page.locator("[data-testid='library-view']", { hasText: '列表视图' }).click();
    await expect(page.getByTestId('case-list')).toBeVisible();
    await expect(page.getByTestId('case-list-row')).toHaveCount(5);
    await expect(page.getByTestId('case-cards')).toHaveCount(0);
    await page.locator("[data-testid='library-view']", { hasText: '卡片视图' }).click();
    await expect(page.getByTestId('case-cards')).toBeVisible();
  });

  test('L2 组织覆盖区与树形进度条可见', async ({ page }) => {
    await expect(page.getByTestId('coverage-panel')).toBeVisible();
    await expect(page.getByTestId('coverage-table')).toBeVisible();
    await expect(page.getByTestId('coverage-heat')).toContainText('业务一线');
    await expect(page.getByTestId('coverage-heat')).toContainText('职能平台');
  });
});
