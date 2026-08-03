import { expect, test } from '@playwright/test';
import {
  BOUNDARY_TOLERANCE,
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

const REGIONS: Region[] = [
  { id: 'R3', name: '页签', x: 242, y: 69, w: 1310, h: 49 },
  { id: 'R4', name: '筛选', x: 242, y: 125, w: 1310, h: 72 },
  { id: 'R5', name: '四张 KPI', x: 242, y: 213, w: 1310, h: 94 },
  { id: 'R6', name: '评审记录表格', x: 242, y: 321, w: 1310, h: 284 },
  { id: 'R7', name: '评审详情', x: 242, y: 623, w: 1310, h: 335 },
];

const COLUMNS = [
  { id: 'select', label: '选择', width: 46 },
  { id: 'name', label: '名称', width: 240 },
  { id: 'round', label: '轮次', width: 150 },
  { id: 'version', label: '版本', width: 100 },
  { id: 'date', label: '评审日期', width: 165 },
  { id: 'result', label: '评审结果', width: 220 },
  { id: 'operator', label: '录入人', width: 120 },
  { id: 'consistent', label: '结论一致', width: 140 },
  { id: 'action', label: '操作', width: 129 },
];

test.describe('P09 评审记录中心', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/reviews');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'review');
  });

  test('L1 五区域外框及内容边界', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 九列列宽合计 1310', async ({ page }) => {
    const headers = page.locator("[data-region='R6'] thead th");
    await expect(headers).toHaveCount(COLUMNS.length);
    let total = 0;

    for (const [index, column] of COLUMNS.entries()) {
      const header = headers.nth(index);
      await expect(header).toHaveAttribute('data-column', column.id);
      if (column.id !== 'select') await expect(header).toHaveText(column.label);
      const box = await header.boundingBox();
      total += box?.width ?? 0;
      expect(Math.abs((box?.width ?? 0) - column.width), `${column.label} 列宽`).toBeLessThanOrEqual(
        BOUNDARY_TOLERANCE,
      );
    }
    expect(Math.abs(total - 1310), `九列合计 ${total}px，应为 1310px`).toBeLessThanOrEqual(
      BOUNDARY_TOLERANCE,
    );
  });

  test('L2 默认选中试讲记录，详情同步并显示红色风险提示', async ({ page }) => {
    const tabs = page.locator("[data-region='R3'] [data-testid='review-tab']");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(1)).toHaveText('试讲记录');
    await expect(tabs.nth(1)).toHaveAttribute('data-active', 'true');

    const selected = page.locator("[data-region='R6'] [data-testid='review-row'][data-selected='true']");
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-record', 'trial-workplace-communication');
    await expect(selected).toContainText('职场高效沟通技巧（试讲）');
    await expect(selected).toContainText('讲师：合格 / 课程：不合格');
    await expect(selected).toHaveAttribute('data-selected', 'true');

    await expect(page.getByTestId('review-detail-title')).toHaveText('职场高效沟通技巧（试讲）');
    const risk = page.getByTestId('review-risk-banner');
    await expect(risk).toContainText('风险提示：讲师结论与课程结论不一致');
    await expect(risk).toHaveCSS('border-top-color', 'rgb(239, 68, 68)');
  });

  test('L2 全页不出现非法结论「待定」', async ({ page }) => {
    await expect(page.locator('.rvw')).not.toContainText('待定');
  });
});
