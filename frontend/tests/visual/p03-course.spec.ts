import { expect, test, type Page } from '@playwright/test';
import {
  BOUNDARY_TOLERANCE,
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

/**
 * P03 课程工作台视觉回归（《设计文档 V2.0》第 7 章，版式按业务裁决改过）。
 *
 * <p>断言顺序按文档 7「页面级验收」：先校 R1/R2，再校正文外框，最后校文字与图表。
 *
 * <p><b>与文档 7 坐标表的差异。</b>课程详情不再是右侧常驻的 R8（1086,62,474,930），
 * 改为双击课程卡后的弹窗；腾出的 474px 归看板，R3～R7 全部通栏 1364px，看板高
 * 438 → 518。文档里「列宽 119 必须照抄」是在有右栏的前提下量的，随之作废。
 *
 * <p>几何之外钉住五件语义上的事：
 * <ul>
 *   <li>七列列名全是课程主状态的合法取值，不出现 `待评审`</li>
 *   <li>KPI 不用子状态名标主状态计数</li>
 *   <li>详情里没有「轨道」，也没有 `评审中` 这个课程状态</li>
 *   <li>没有手工创建材料版本的入口</li>
 *   <li>进页不预开详情：单击只选中，双击才弹窗</li>
 * </ul>
 */

/** 区域坐标。R1/R2 由 expectShellGeometry 覆盖，这里从 R3 起；详情已不在坐标表里 */
const REGIONS: Region[] = [
  { id: 'R3', name: '五张 KPI', x: 198, y: 62, w: 1364, h: 98 },
  { id: 'R4', name: '筛选器', x: 198, y: 173, w: 1364, h: 80 },
  { id: 'R5', name: '七列课程看板', x: 198, y: 265, w: 1364, h: 518 },
  { id: 'R6', name: '课程排期日历', x: 198, y: 798, w: 835, h: 194 },
  { id: 'R7', name: '数据概览', x: 1045, y: 798, w: 517, h: 194 },
];

/** 看板内宽 1356（1364 − 3×2 内边距 − 1×2 边框），减六个 6px 列间距后七等分 */
const COLUMN_WIDTH = 188.6;
/** 卡片宽 = 列宽 − 列的左右内边距 5×2 */
const CARD_WIDTH = COLUMN_WIDTH - 10;
/** 详情弹窗里那门课，也是看板默认选中的那张卡 */
const DETAIL_COURSE = 'C-0842';

/** 双击默认选中的课程卡，返回详情弹窗里的正文 locator */
async function openDetail(page: Page) {
  await page.locator(`[data-region='R5'] [data-course='${DETAIL_COURSE}']`).dblclick();
  const detail = page.locator("[data-testid='course-detail']");
  await expect(detail).toBeVisible();
  return detail;
}

/** 业务点名的五张卡。评审中给跌，用来钉住下跌箭头 */
const KPIS = [
  { id: 'total', label: '课程总数', value: '842', delta: '↑ 8.3%' },
  { id: 'developing', label: '开发中', value: '214', delta: '↑ 12.5%' },
  { id: 'reviewing', label: '评审中', value: '96', delta: '↓ 4.2%' },
  { id: 'pendingTrial', label: '待试讲', value: '52', delta: '↑ 7.1%' },
  { id: 'published', label: '已发布', value: '180', delta: '↑ 6.4%' },
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

  test('L1 五区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 五区域内容不溢出区域', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 看板通栏 1364px，七列等宽 188.6px', async ({ page }) => {
    const columns = page.locator("[data-region='R5'] [data-testid='board-column']");
    await expect(columns).toHaveCount(7);

    for (let index = 0; index < 7; index += 1) {
      const box = await columns.nth(index).boundingBox();
      expect(box, `第 ${index + 1} 列取不到 boundingBox`).not.toBeNull();
      expect(
        Math.abs((box?.width ?? 0) - COLUMN_WIDTH),
        `第 ${index + 1} 列实测 ${box?.width}px，应为 ${COLUMN_WIDTH}px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }

    // 七列 + 六个间距必须正好填满通栏的看板区，首列左沿与末列右沿各留 3px 内边距
    const first = await columns.nth(0).boundingBox();
    const last = await columns.nth(6).boundingBox();
    const board = await page.locator("[data-region='R5']").boundingBox();
    expect(Math.abs((first?.x ?? 0) - ((board?.x ?? 0) + 3))).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    expect(
      Math.abs((last?.x ?? 0) + (last?.width ?? 0) - ((board?.x ?? 0) + (board?.width ?? 0) - 3)),
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  });

  test('L1 课程卡 178.6×126', async ({ page }) => {
    const cards = page.locator("[data-region='R5'] [data-testid='course-card']");
    // fixture 每列三张，七列共 21 张；518px 的列高放得下的也正好是三张
    await expect(cards).toHaveCount(21);

    for (const index of [0, 10, 20]) {
      const box = await cards.nth(index).boundingBox();
      expect(
        Math.abs((box?.width ?? 0) - CARD_WIDTH),
        `第 ${index + 1} 张卡宽 ${box?.width}px，应为 ${CARD_WIDTH}px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
      expect(Math.abs((box?.height ?? 0) - 126), `第 ${index + 1} 张卡高 ${box?.height}px`).toBeLessThanOrEqual(
        BOUNDARY_TOLERANCE,
      );
    }
  });

  test('L2 五张 KPI 卡名与环比', async ({ page }) => {
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
    // `待评审` 不是课程任何状态机里的值；卡名「评审中」是展示名，计数仍取主状态「评审决策」
    await expect(row).not.toContainText('待评审');
    await expect(row).not.toContainText('试讲中');
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

  test('L2 进页不预开详情，单击只选中，双击才弹窗', async ({ page }) => {
    await expect(page.locator("[data-testid='course-detail-modal']")).toHaveCount(0);

    const other = page.locator("[data-region='R5'] [data-course='C-0819']");
    await other.click();
    await expect(other).toHaveAttribute('data-selected', 'true');
    await expect(page.locator("[data-region='R5'] [data-selected='true']")).toHaveCount(1);
    // 单击弹窗的话，运营在七列之间比对课程时每点一下都会被弹窗挡住整屏
    await expect(page.locator("[data-testid='course-detail-modal']")).toHaveCount(0);

    await other.dblclick();
    const modal = page.locator("[data-testid='course-detail-modal']");
    await expect(modal).toBeVisible();
    // 标题行跟着被双击的那张卡走，不是永远显示 fixture 里那门课
    await expect(modal.locator('.crs-detail-name')).toHaveText('时间管理与效率提升');
  });

  test('L2 弹窗三条退出路径：关闭按钮、Esc、点遮罩', async ({ page }) => {
    const modal = page.locator("[data-testid='course-detail-modal']");

    await openDetail(page);
    await page.getByRole('button', { name: '关闭课程详情' }).click();
    await expect(modal).toHaveCount(0);

    await openDetail(page);
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);

    await openDetail(page);
    // 遮罩点在弹窗之外：正文区域的 click 不冒泡到遮罩，否则读详情时点一下正文就关了
    await page.locator('.crs-modal-mask').click({ position: { x: 10, y: 10 } });
    await expect(modal).toHaveCount(0);
  });

  test('L2 键盘可达：卡片能聚焦，回车等价于双击', async ({ page }) => {
    const card = page.locator(`[data-region='R5'] [data-course='${DETAIL_COURSE}']`);
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator("[data-testid='course-detail-modal']")).toBeVisible();
  });

  test('L2 详情：默认展开课程材料与版本，没有轨道也没有「评审中」', async ({ page }) => {
    const detail = await openDetail(page);
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
    const detail = await openDetail(page);
    const versions = detail.locator("[data-testid='course-version']");
    await expect(versions).toHaveCount(3);
    await expect(versions.nth(0)).toContainText('V3');
    await expect(versions.nth(0)).toContainText('2024-06-07 14:20');
    await expect(versions.nth(0)).toHaveAttribute('data-current', 'true');
    await expect(versions.nth(1)).toContainText('2024-06-03 10:15');
    await expect(versions.nth(2)).toContainText('2024-05-28 16:40');

    // 材料版本是提交评审时系统自动快照的（需求 R7），手工入口会建出游离于轮次之外的版本
    await expect(detail).not.toContainText('创建快照');
    await expect(detail).not.toContainText('新建版本');
  });

  test('L2 自检完成度 76.0%', async ({ page }) => {
    const detail = await openDetail(page);
    const block = detail.locator("[data-testid='checklist-block']");
    // 百分比保留 1 位小数，整数也保留（设计规范 3.3）
    await expect(block).toContainText('76.0%');
    await expect(block.locator("[role='progressbar']")).toHaveAttribute('aria-valuenow', '76');
  });

  test('L2 详情动作：三个结论可点，两个置灰带原因，两个不存在的不渲染', async ({ page }) => {
    const detail = await openDetail(page);
    const actions = detail.locator("[data-testid='guarded-action']");
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
    await expect(detail.locator("[data-action='创建快照']")).toHaveCount(0);
    await expect(detail.locator("[data-action='进入试讲']")).toHaveCount(0);
  });

  test('L2 五个动作按钮一个都没被弹窗裁掉', async ({ page }) => {
    /*
     * 动作名的长度由状态机转换表决定，不由前端决定：
     * 「录入结论=不通过·修改后重新评审」15 个字。弹窗比原来那 474px 的详情栏宽，
     * 但按钮仍可能被 overflow 裁掉，而<b>被裁掉的按钮既看不见也点不到</b>，
     * 表现和「这个动作不可用」完全一样 —— 这类失效不会报错，只会让运营以为没有这个操作。
     */
    const detail = await openDetail(page);
    const panel = await detail.boundingBox();
    const actions = detail.locator("[data-testid='guarded-action']");

    for (let index = 0; index < 5; index += 1) {
      const box = await actions.nth(index).boundingBox();
      expect(box, `第 ${index + 1} 个按钮取不到 boundingBox，说明它已被裁到视口外`).not.toBeNull();
      const right = (box?.x ?? 0) + (box?.width ?? 0);
      const panelRight = (panel?.x ?? 0) + (panel?.width ?? 0);
      expect(right, `第 ${index + 1} 个按钮右沿 ${right} 超出弹窗右沿 ${panelRight}`).toBeLessThanOrEqual(
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

  test('L2 数据概览三个数都带时间窗口，不会被读成累计值', async ({ page }) => {
    const overview = page.locator("[data-region='R7']");
    /*
     * 面板标题必须带「本周」。三个数都是周窗口内的增量，
     * 不写窗口的话「状态流转数 128」会被读成累计值，与看板七列的存量计数混为一谈 ——
     * 而看板那七个数就在同一屏的左边。
     */
    await expect(overview).toContainText('本周');

    const items = overview.locator("[data-testid='overview-item']");
    await expect(items).toHaveCount(3);

    const METRICS = [
      { label: '状态流转数', value: '128', delta: '↑ 15.2%' },
      { label: '新建课程数', value: '24', delta: '↑ 9.8%' },
      // 百分比保留 1 位小数（设计规范 3.3）
      { label: '评审通过率', value: '76.3%', delta: '↑ 4.3%' },
    ];
    for (const [index, metric] of METRICS.entries()) {
      await expect(items.nth(index)).toContainText(metric.label);
      await expect(items.nth(index)).toContainText(metric.value);
      await expect(items.nth(index)).toContainText(metric.delta);
    }
  });
});
