import { expect, test } from '@playwright/test';
import {
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

/**
 * P05 培训运营地图视觉回归（《设计文档 V2.0》第 9 章）。
 *
 * <p>断言顺序按文档 9「页面级验收」：先校 R1/R2，再校正文外框，最后校文字与图表。
 *
 * <p>几何之外钉住五件语义上的事：
 * <ul>
 *   <li>场次状态只有 待开课／已开课／已结束／已归档，不出现「进行中」「待开始」</li>
 *   <li>六张 KPI 用 V2.0／7.4 的名字（含「本周培训计划数」「待导入签到」）</li>
 *   <li>计划列表八列列宽合计 814（文档标注「必须照抄」）</li>
 *   <li>导入结果三词是 写入／覆盖更新／自动补入，不是成功／重复／未匹配</li>
 *   <li>月／周／日切换后日历区域会重排（不是只换高亮）</li>
 * </ul>
 */

const REGIONS: Region[] = [
  { id: 'R3', name: '六张 KPI', x: 273, y: 70, w: 1289, h: 111 },
  { id: 'R4', name: '日历工具条', x: 273, y: 196, w: 1289, h: 48 },
  { id: 'R5', name: '培训月历', x: 273, y: 257, w: 814, h: 455 },
  { id: 'R6', name: '培训计划列表', x: 273, y: 728, w: 814, h: 242 },
  { id: 'R7', name: '培训详情', x: 1102, y: 257, w: 450, h: 669 },
];

const KPIS = [
  { id: 'monthPlans', label: '本月培训计划数', value: '128' },
  { id: 'weekPlans', label: '本周培训计划数', value: '32' },
  { id: 'runningSessions', label: '进行中培训场次', value: '18' },
  { id: 'monthAttendees', label: '本月参训人次', value: '1,236' },
  { id: 'pendingAttendance', label: '待导入签到', value: '86' },
  { id: 'pendingArchive', label: '待归档', value: '42' },
];

const LIST_COLUMNS = [
  { id: 'planName', label: '计划名称', width: 155 },
  { id: 'session', label: '场次', width: 110 },
  { id: 'course', label: '课程名称', width: 140 },
  { id: 'lecturer', label: '讲师', width: 75 },
  { id: 'date', label: '计划日期', width: 120 },
  { id: 'attendance', label: '签到', width: 90 },
  { id: 'feedback', label: '反馈', width: 75 },
  { id: 'action', label: '操作', width: 49 },
];

const LEGAL_SESSION_STATES = ['待开课', '已开课', '已结束', '已归档'];

test.describe('P05 培训运营地图', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/trainings');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'training');
  });

  test('L1 五区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 五区域内容不溢出区域', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 工具条与 KPI 同宽通栏，左栏与详情同起点', async ({ page }) => {
    const kpi = await page.locator("[data-region='R3']").boundingBox();
    const toolbar = await page.locator("[data-region='R4']").boundingBox();
    const calendar = await page.locator("[data-region='R5']").boundingBox();
    const detail = await page.locator("[data-region='R7']").boundingBox();
    expect(kpi).toBeTruthy();
    expect(toolbar).toBeTruthy();
    expect(calendar).toBeTruthy();
    expect(detail).toBeTruthy();
    expect(Math.abs(kpi!.width - toolbar!.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(calendar!.y - detail!.y)).toBeLessThanOrEqual(2);
  });

  test('L1 计划列表八列列宽合计正好 814', async ({ page }) => {
    const widths = await page.locator('.trn-table col').evaluateAll((cols) =>
      cols.map((col) => Math.round((col as HTMLElement).getBoundingClientRect().width)),
    );
    expect(widths).toHaveLength(LIST_COLUMNS.length);
    LIST_COLUMNS.forEach((column, index) => {
      expect(Math.abs(widths[index]! - column.width), `${column.label} 列宽`).toBeLessThanOrEqual(2);
    });
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(814);
  });

  test('L2 六张 KPI 名称与冻结值', async ({ page }) => {
    for (const kpi of KPIS) {
      const card = page.locator(`[data-testid='training-kpi'][data-kpi='${kpi.id}']`);
      await expect(card.locator('.trn-kpi-label')).toHaveText(kpi.label);
      await expect(card.locator('.trn-kpi-value')).toHaveText(kpi.value);
    }
  });

  test('L2 场次状态只有四值合法枚举，不出现进行中／待开始', async ({ page }) => {
    const states = await page.locator('[data-testid="session-state"]').allTextContents();
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      expect(LEGAL_SESSION_STATES, `非法状态「${state}」`).toContain(state.trim());
    }
    await expect(page.getByText('待开始', { exact: true })).toHaveCount(0);
    // 「进行中」会出现在 KPI 名「进行中培训场次」里，所以只禁 data-state
    await expect(page.locator('[data-state="进行中"]')).toHaveCount(0);
    await expect(page.locator('[data-state="待开始"]')).toHaveCount(0);
  });

  test('L2 默认选中 9 日与默认场次，详情标题与签到圆环', async ({ page }) => {
    await expect(page.locator("[data-testid='calendar-day'][data-selected='true']")).toHaveAttribute(
      'data-day',
      '9',
    );
    await expect(page.getByTestId('detail-title')).toHaveText('AI工具实战营 第5期-第2场');
    await expect(page.getByTestId('attendance-ring')).toContainText('57%');
    await expect(page.getByTestId('attendance-ring')).toContainText('已签到 32');
    await expect(page.getByTestId('attendance-ring')).toContainText('应签到 56');
  });

  test('L2 导入结果三词对齐 14.4，不是成功／重复／未匹配', async ({ page }) => {
    const block = page.getByTestId('import-result');
    await expect(block).toContainText('写入');
    await expect(block).toContainText('覆盖更新');
    await expect(block).toContainText('自动补入');
    await expect(block).not.toContainText('成功');
    await expect(block).not.toContainText('重复');
    await expect(block).not.toContainText('未匹配');
  });

  test('L2 详情五个页签，默认停在基本信息；培训形式是线上不是线上直播', async ({ page }) => {
    const tabs = page.getByTestId('training-tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toHaveAttribute('data-active', 'true');
    await expect(tabs.nth(0)).toHaveText('基本信息');
    const form = page.locator("[data-testid='training-field']").filter({ hasText: '培训形式' });
    await expect(form.locator('dd')).toHaveText('线上');
    await expect(page.getByText('线上直播', { exact: true })).toHaveCount(0);
  });

  test('L2 今日提醒三条，底部运营引导两种模式都在', async ({ page }) => {
    const reminders = page.getByTestId('today-reminders').locator('li');
    await expect(reminders).toHaveCount(3);
    await expect(reminders.nth(0)).toContainText('09:00');
    await expect(reminders.nth(1)).toContainText('AI工具实战');
    await expect(page.getByTestId('training-cta')).toContainText('新建培训计划');
  });

  test('L2 月／周／日切换必须重排', async ({ page }) => {
    await expect(page.locator('.trn-month')).toBeVisible();

    await page.locator("[data-testid='calendar-view'][data-active='false']", { hasText: '周' }).click();
    await expect(page.getByTestId('week-grid')).toBeVisible();
    await expect(page.locator('.trn-month')).toHaveCount(0);

    await page.locator("[data-testid='calendar-view']", { hasText: '日' }).click();
    await expect(page.getByTestId('day-grid')).toBeVisible();
    await expect(page.getByTestId('week-grid')).toHaveCount(0);
    await expect(page.getByTestId('day-session')).toHaveCount(3);

    await page.locator("[data-testid='calendar-view']", { hasText: '月' }).click();
    await expect(page.locator('.trn-month')).toBeVisible();
  });

  test('L2 计划列表四行，签到比与反馈分可见', async ({ page }) => {
    const rows = page.getByTestId('plan-row');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('32/56');
    await expect(page.getByTestId('plan-list-total')).toHaveText('42');
    for (const column of LIST_COLUMNS) {
      await expect(page.locator(`.trn-table th[data-col='${column.id}']`)).toHaveText(column.label);
    }
  });
});
