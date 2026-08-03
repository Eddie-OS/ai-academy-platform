import { expect, test } from '@playwright/test';
import {
  BOUNDARY_TOLERANCE,
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

/**
 * P03 课程工作台视觉回归（《设计文档 V2.0》第 7 章）。
 *
 * <p>断言顺序按文档 7「页面级验收」：先校 R1/R2，再校正文外框，最后校文字与图表。
 *
 * <p>几何之外钉住四件语义上的事：
 * <ul>
 *   <li>七列列名全是课程主状态的合法取值，不出现 `待评审`</li>
 *   <li>KPI 不用子状态名标主状态计数</li>
 *   <li>详情里没有「轨道」，也没有 `评审中` 这个课程状态</li>
 *   <li>没有手工创建材料版本的入口</li>
 * </ul>
 */

/** 文档 7「区域坐标（CSS px）」表。R1/R2 由 expectShellGeometry 覆盖，这里从 R3 起 */
const REGIONS: Region[] = [
  { id: 'R3', name: '五张 KPI', x: 198, y: 62, w: 875, h: 98 },
  { id: 'R4', name: '筛选器', x: 198, y: 173, w: 875, h: 80 },
  { id: 'R5', name: '七列课程看板', x: 198, y: 265, w: 875, h: 438 },
  { id: 'R6', name: '课程排期日历', x: 198, y: 718, w: 533, h: 194 },
  { id: 'R7', name: '数据概览', x: 743, y: 718, w: 330, h: 194 },
  { id: 'R8', name: '课程详情', x: 1086, y: 62, w: 474, h: 930 },
];

/** 文档 7「冻结 KPI」表，标签已按裁决换成课程主状态名 */
const KPIS = [
  { id: 'total', label: '课程总数', value: '842', delta: '↑ 8.3%' },
  { id: 'developing', label: '开发', value: '214', delta: '↑ 12.5%' },
  { id: 'reviewing', label: '评审决策', value: '96', delta: '↑ 9.2%' },
  { id: 'trial', label: '试讲', value: '52', delta: '↑ 7.1%' },
  { id: 'published', label: '发布', value: '180', delta: '↑ 6.4%' },
];

/** 文档 7「冻结数据」：看板列及数量 */
const BOARD = [
  { id: 'proposed', title: '立项', count: 18 },
  { id: 'development', title: '开发', count: 214 },
  { id: 'selfCheck', title: '自检', count: 136 },
  { id: 'reviewDecision', title: '评审决策', count: 96 },
  { id: 'trial', title: '试讲', count: 52 },
  { id: 'published', title: '发布', count: 180 },
  { id: 'promotion', title: '推广 / 精品案例', count: 132 },
];

test.describe('P03 课程工作台', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/courses');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'course');
  });

  test('L1 六区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 六区域内容不溢出区域', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 看板七列每列 119px（文档标注「必须照抄」）', async ({ page }) => {
    const columns = page.locator("[data-region='R5'] [data-testid='board-column']");
    await expect(columns).toHaveCount(7);

    for (let index = 0; index < 7; index += 1) {
      const box = await columns.nth(index).boundingBox();
      expect(box, `第 ${index + 1} 列取不到 boundingBox`).not.toBeNull();
      expect(
        Math.abs((box?.width ?? 0) - 119),
        `第 ${index + 1} 列实测 ${box?.width}px，应为 119px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }

    // 七列 + 六个间距必须正好填满 875 的看板区，首列左沿与末列右沿各留 3px 内边距
    const first = await columns.nth(0).boundingBox();
    const last = await columns.nth(6).boundingBox();
    const board = await page.locator("[data-region='R5']").boundingBox();
    expect(Math.abs((first?.x ?? 0) - ((board?.x ?? 0) + 3))).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    expect(
      Math.abs((last?.x ?? 0) + (last?.width ?? 0) - ((board?.x ?? 0) + (board?.width ?? 0) - 3)),
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  });

  test('L1 课程卡 109×126', async ({ page }) => {
    const cards = page.locator("[data-region='R5'] [data-testid='course-card']");
    // 438px 的列高放得下 3 张卡，七列共 21 张
    await expect(cards).toHaveCount(21);

    for (const index of [0, 10, 20]) {
      const box = await cards.nth(index).boundingBox();
      expect(Math.abs((box?.width ?? 0) - 109), `第 ${index + 1} 张卡宽 ${box?.width}px`).toBeLessThanOrEqual(
        BOUNDARY_TOLERANCE,
      );
      expect(Math.abs((box?.height ?? 0) - 126), `第 ${index + 1} 张卡高 ${box?.height}px`).toBeLessThanOrEqual(
        BOUNDARY_TOLERANCE,
      );
    }
  });

  test('L2 五张 KPI 不用子状态名标主状态计数', async ({ page }) => {
    const cards = page.locator("[data-region='R3'] [data-testid='course-kpi']");
    await expect(cards).toHaveCount(KPIS.length);

    for (const [index, kpi] of KPIS.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute('data-kpi', kpi.id);
      await expect(card).toContainText(kpi.label);
      await expect(card).toContainText(kpi.value);
      await expect(card).toContainText(kpi.delta);
    }

    const row = page.locator("[data-region='R3']");
    // `待评审` 不是课程任何状态机里的值
    await expect(row).not.toContainText('待评审');
    // 这三个是子状态名，拿来标主状态计数会与实际不符（主状态=开发 的子状态可能是待开发）
    await expect(row).not.toContainText('开发中');
    await expect(row).not.toContainText('试讲中');
    await expect(row).not.toContainText('已发布');
  });

  test('L2 看板七列列名与计数，且列名全是课程主状态的合法取值', async ({ page }) => {
    const columns = page.locator("[data-region='R5'] [data-testid='board-column']");

    for (const [index, column] of BOARD.entries()) {
      const node = columns.nth(index);
      await expect(node).toHaveAttribute('data-column', column.id);
      await expect(node).toContainText(column.title);
      await expect(node).toContainText(String(column.count));
    }
  });

  test('L2 看板计数合计 828，与 KPI 课程总数 842 刻意不等', async ({ page }) => {
    const counts = await page
      .locator("[data-region='R5'] [data-testid='board-column'] .crs-col-count")
      .allTextContents();
    const total = counts.reduce((sum, text) => sum + Number(text.trim()), 0);

    // 差的 14 门在 已关闭／课程归档／案例归档 三个终态里，这三个状态退出预警范围、不上看板。
    // 断言这个差值，是为了防止有人「顺手」把某一列改成 28 让两个数对上
    expect(total, '七列计数合计').toBe(828);
    await expect(page.locator("[data-region='R3'] [data-kpi='total']")).toContainText('842');
  });

  test('L2 默认选中卡是信息安全意识培训，且只有一张选中', async ({ page }) => {
    const selected = page.locator("[data-region='R5'] [data-testid='course-card'][data-selected='true']");
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-course', 'C-0842');
    await expect(selected).toContainText('信息安全意识培训');
    // 15 组件矩阵：Card selected 用 aria-current
    await expect(selected).toHaveAttribute('aria-current', 'true');
  });

  test('L2 详情：默认展开课程材料与版本，没有轨道也没有「评审中」', async ({ page }) => {
    const detail = page.locator("[data-region='R8']");
    await expect(detail).toContainText('信息安全意识培训');

    const tabs = detail.locator("[data-testid='course-tab']");
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(2)).toHaveText('课程材料与版本');
    await expect(tabs.nth(2)).toHaveAttribute('data-active', 'true');

    // 需求文档里没有「轨道」这个字段，最接近的是课程类型
    await expect(detail).not.toContainText('轨道');
    await expect(detail).toContainText('课程类型');
    await expect(detail).toContainText('内部讲师课程');

    // 评审决策没有子状态，`评审中` 不是任何课程状态机的取值
    await expect(detail).not.toContainText('子状态');
    await expect(detail).toContainText('待录入结论 · 第 1 轮');
  });

  test('L2 三个材料版本，且没有手工创建版本的入口', async ({ page }) => {
    const versions = page.locator("[data-region='R8'] [data-testid='course-version']");
    await expect(versions).toHaveCount(3);
    await expect(versions.nth(0)).toContainText('V3');
    await expect(versions.nth(0)).toContainText('2024-06-07 14:20');
    await expect(versions.nth(0)).toHaveAttribute('data-current', 'true');
    await expect(versions.nth(1)).toContainText('2024-06-03 10:15');
    await expect(versions.nth(2)).toContainText('2024-05-28 16:40');

    // 材料版本是提交评审时系统自动快照的（需求 R7），手工入口会建出游离于轮次之外的版本
    await expect(page.locator("[data-region='R8']")).not.toContainText('创建快照');
    await expect(page.locator("[data-region='R8']")).not.toContainText('新建版本');
  });

  test('L2 自检完成度 76.0%', async ({ page }) => {
    const block = page.locator("[data-region='R8'] [data-testid='checklist-block']");
    // 百分比保留 1 位小数，整数也保留（设计规范 3.3）
    await expect(block).toContainText('76.0%');
    await expect(block.locator("[role='progressbar']")).toHaveAttribute('aria-valuenow', '76');
  });

  test('L2 详情动作：三个结论可点，两个置灰带原因，两个不存在的不渲染', async ({ page }) => {
    const actions = page.locator("[data-region='R8'] [data-testid='guarded-action']");
    await expect(actions).toHaveCount(5);

    const allowed = ['录入结论=通过', '录入结论=不通过·修改后重新评审', '录入结论=不通过·关闭'];
    for (const [index, action] of allowed.entries()) {
      await expect(actions.nth(index)).toHaveAttribute('data-action', action);
      await expect(actions.nth(index)).toHaveAttribute('data-state', 'allowed');
      await expect(actions.nth(index)).toBeEnabled();
    }

    for (const index of [3, 4]) {
      await expect(actions.nth(index)).toHaveAttribute('data-state', 'blocked');
      await expect(actions.nth(index)).toBeDisabled();
    }
    await expect(actions.nth(3)).toHaveAttribute('data-action', '提交评审');
    await expect(actions.nth(4)).toHaveAttribute('data-action', '关闭课程开发');

    // 「创建快照」与「进入试讲」不是动作，两个列表里都没有，因此一个按钮都不渲染
    await expect(page.locator("[data-region='R8'] [data-action='创建快照']")).toHaveCount(0);
    await expect(page.locator("[data-region='R8'] [data-action='进入试讲']")).toHaveCount(0);
  });

  test('L2 五个动作按钮一个都没被面板裁掉', async ({ page }) => {
    /*
     * 动作名的长度由状态机转换表决定，不由前端决定：
     * 「录入结论=不通过·修改后重新评审」15 个字，三个这样的按钮在 474px 的面板里必须换行。
     * 不换行时多出来的按钮会被 overflow:hidden 裁掉，而<b>被裁掉的按钮既看不见也点不到</b>，
     * 表现和「这个动作不可用」完全一样 —— 这类失效不会报错，只会让运营以为没有这个操作。
     */
    const panel = await page.locator("[data-region='R8']").boundingBox();
    const actions = page.locator("[data-region='R8'] [data-testid='guarded-action']");

    for (let index = 0; index < 5; index += 1) {
      const box = await actions.nth(index).boundingBox();
      expect(box, `第 ${index + 1} 个按钮取不到 boundingBox，说明它已被裁到视口外`).not.toBeNull();
      const right = (box?.x ?? 0) + (box?.width ?? 0);
      const panelRight = (panel?.x ?? 0) + (panel?.width ?? 0);
      expect(right, `第 ${index + 1} 个按钮右沿 ${right} 超出面板右沿 ${panelRight}`).toBeLessThanOrEqual(
        panelRight,
      );
    }
  });

  test('L2 排期日历定死 2024 年 6 月，选中 12 日三场', async ({ page }) => {
    const calendar = page.locator("[data-region='R6']");
    // 文档 0.3 与 15.1：不得使用今天。取当前月会让基线每月失效一次
    await expect(calendar).toContainText('2024 年 6 月');

    const selected = calendar.locator("[data-testid='calendar-day'][data-selected='true']");
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('12');

    const sessions = calendar.locator("[data-testid='calendar-session']");
    await expect(sessions).toHaveCount(3);
    await expect(sessions.nth(0)).toContainText('09:00');
    await expect(sessions.nth(0)).toContainText('领导力修炼');
    await expect(sessions.nth(1)).toContainText('14:00');
    await expect(sessions.nth(1)).toContainText('时间管理与效率提升');
    await expect(sessions.nth(2)).toContainText('16:00');
    await expect(sessions.nth(2)).toContainText('信息安全意识培训');
  });

  test('L2 数据概览三个数都能由已冻结数据推出', async ({ page }) => {
    const items = page.locator("[data-region='R7'] [data-testid='overview-item']");
    await expect(items).toHaveCount(3);
    // 828 = 七列之和；180 = KPI 发布；14 = 842 - 828
    await expect(items.nth(0)).toContainText('828');
    await expect(items.nth(1)).toContainText('180');
    await expect(items.nth(2)).toContainText('14');
  });
});
