import { expect, test } from '@playwright/test';
import {
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

const REGIONS: Region[] = [
  { id: 'R3', name: '任务页签', x: 224, y: 68, w: 1001, h: 52 },
  { id: 'R4', name: '五张 KPI', x: 224, y: 131, w: 1001, h: 100 },
  { id: 'R5', name: '筛选器', x: 224, y: 247, w: 1001, h: 71 },
  { id: 'R6', name: '任务表格', x: 224, y: 331, w: 1001, h: 438 },
  { id: 'R7', name: '本周重点', x: 224, y: 817, w: 551, h: 150 },
  { id: 'R8', name: '空状态', x: 797, y: 817, w: 428, h: 150 },
  { id: 'R9', name: '任务详情', x: 1248, y: 68, w: 328, h: 899 },
];

const COLUMNS = [
  { id: 'select', width: 36 },
  { id: 'title', width: 240 },
  { id: 'type', width: 95 },
  { id: 'object', width: 130 },
  { id: 'owner', width: 80 },
  { id: 'deadline', width: 100 },
  { id: 'remaining', width: 80 },
  { id: 'state', width: 85 },
  { id: 'overdue', width: 100 },
  { id: 'action', width: 55 },
];

test.describe('P07 任务中心', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/tasks');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'task');
  });

  test('L1 七区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 区域内容不溢出', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 任务表十列宽度合计 1001', async ({ page }) => {
    const widths = await page.locator('.tsk-table col').evaluateAll((cols) =>
      cols.map((col) => Math.round((col as HTMLElement).getBoundingClientRect().width)),
    );
    expect(widths).toHaveLength(COLUMNS.length);
    COLUMNS.forEach((column, index) => {
      expect(Math.abs(widths[index]! - column.width), column.id).toBeLessThanOrEqual(2);
    });
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(1001);
  });

  test('L2 五张 KPI 与冻结数值', async ({ page }) => {
    const expected = [
      ['all', '全部任务', '1,268'],
      ['pending', '待处理', '312'],
      ['processing', '处理中', '214'],
      ['completed', '已完成', '689'],
      ['overdue', '逾期', '53'],
    ];
    for (const [id, label, value] of expected) {
      const card = page.locator(`[data-testid='task-kpi'][data-kpi='${id}']`);
      await expect(card.locator('.tsk-kpi-label')).toHaveText(label!);
      await expect(card.locator('.tsk-kpi-value')).toHaveText(value!);
    }
  });

  test('L2 状态只用四值，逾期独立为标记', async ({ page }) => {
    const states = await page.locator('.tsk-table .tsk-state').allTextContents();
    for (const state of states) {
      expect(['待处理', '处理中', '已完成', '已关闭']).toContain(state.trim());
    }
    await expect(page.locator('.tsk-table .tsk-state', { hasText: '逾期' })).toHaveCount(0);
    await expect(page.getByTestId('task-warning')).toHaveCount(4);
  });

  test('L2 默认全部任务与提示工程审核任务被选中', async ({ page }) => {
    await expect(page.getByTestId('task-tab').first()).toHaveAttribute('data-active', 'true');
    const selected = page.locator("[data-testid='task-row'][data-selected='true']");
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText('AI课程《提示工程》内容审核');
    await expect(selected).toContainText('待处理');
    await expect(selected).toContainText('提示工程');
    await expect(page.getByTestId('task-detail-title')).toHaveText('AI课程《提示工程》内容审核');
  });

  test('L2 使用按负责人页签、蓝黄红无灯筛选和新建任务空状态', async ({ page }) => {
    await expect(page.getByText('我的任务', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('task-tab').nth(1)).toHaveText('按负责人');
    await expect(page.getByTestId('task-filter').nth(2)).toContainText('全部');
    await expect(page.locator("[data-region='R8']")).toContainText('暂无需要关注的任务');
    await expect(page.locator("[data-region='R8']").getByRole('button', { name: '新建任务' })).toBeVisible();
  });
});
