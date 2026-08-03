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
 * P01 总看板视觉回归（《设计文档 V2.0》第 5 章）。
 *
 * <p>断言顺序按文档 5「页面级验收」：先 R1/R2 壳层，再正文各区域外框，最后文字与图表。
 * 「任何一级边界超过 2px 都不进入颜色和细节验收」—— 所以边界断言失败时，
 * 后面的文本断言即使通过也没有意义。
 */

/** 文档 5「区域坐标（CSS px）」表。R1/R2 由 expectShellGeometry 覆盖，这里从 R3 起 */
const REGIONS: Region[] = [
  { id: 'R3', name: '六张 KPI', x: 242, y: 86, w: 1320, h: 124 },
  { id: 'R4', name: '五张业务入口卡', x: 242, y: 229, w: 1320, h: 216 },
  { id: 'R5', name: '三色灯预警', x: 242, y: 461, w: 499, h: 282 },
  { id: 'R6', name: '待办行动清单', x: 752, y: 461, w: 810, h: 282 },
  { id: 'R7', name: '效率指标', x: 242, y: 758, w: 807, h: 211 },
  { id: 'R8', name: '业务价值', x: 1062, y: 758, w: 239, h: 211 },
  { id: 'R9', name: '欢迎卡', x: 1312, y: 758, w: 250, h: 211 },
];

/** 文档 5「内部几何」：待办行动清单 810px 的七列宽度，标注为「必须照抄」 */
const WORKLIST_COLUMN_WIDTHS = [
  { label: '责任人', width: 90 },
  { label: '业务对象', width: 165 },
  { label: '当前节点', width: 135 },
  { label: '截止日期', width: 130 },
  { label: '剩余天数', width: 80 },
  { label: '预警灯', width: 100 },
  { label: '操作', width: 110 },
];

test.describe('P01 总看板', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'dashboard');
  });

  test('L1 九区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 九区域内容不溢出区域', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 待办清单七列列宽（文档标注「必须照抄」）', async ({ page }) => {
    const headers = page.locator("[data-region='R6'] thead th");
    await expect(headers).toHaveCount(WORKLIST_COLUMN_WIDTHS.length);

    for (const [index, column] of WORKLIST_COLUMN_WIDTHS.entries()) {
      const header = headers.nth(index);
      await expect(header, `第 ${index + 1} 列应是「${column.label}」`).toHaveText(column.label);
      const box = await header.boundingBox();
      expect(
        Math.abs((box?.width ?? 0) - column.width),
        `「${column.label}」列宽实测 ${box?.width}，应为 ${column.width}`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }
  });

  test('L2 冻结 KPI 六项数值与环比', async ({ page }) => {
    const expected = [
      ['需求总数', '1,268', '↑ 12.5%'],
      ['课程总数', '842', '↑ 8.3%'],
      ['已发布课程', '512', '↑ 14.7%'],
      ['讲师池人数', '1,236', '↑ 7.9%'],
      ['培训场次数', '328', '↑ 20.1%'],
      ['案例上架数', '186', '↑ 10.4%'],
    ];
    const cards = page.locator("[data-region='R3'] .kpi");
    await expect(cards).toHaveCount(expected.length);

    for (const [index, [label, value, delta]] of expected.entries()) {
      const card = cards.nth(index);
      await expect(card.locator('.kpi-label')).toHaveText(label);
      await expect(card.locator('.kpi-value')).toHaveText(value);
      await expect(card.locator('.kpi-delta')).toHaveText(delta);
    }
  });

  /**
   * 预警区是三张卡，不是四张（业务裁决 V-9：蓝灯即健康态）。
   *
   * <p>这条断言同时防两个方向的回退：有人照需求 13.4.1a 把蓝灯改回「即将到期」
   * 并补一张健康卡，或者有人把红灯卡的标题写成只有「已逾期」——
   * 后者会让运营以为停滞的对象没被算进这个 9。
   */
  test('L2 预警区三张卡，红灯标题覆盖两种成因', async ({ page }) => {
    const cards = page.locator("[data-region='R5'] [data-testid='warning-summary-card']");
    await expect(cards).toHaveCount(3);

    await expect(cards.nth(0)).toContainText('正常运行');
    await expect(cards.nth(0)).toContainText('128');
    await expect(cards.nth(1)).toContainText('需要关注');
    await expect(cards.nth(1)).toContainText('26');
    await expect(cards.nth(2)).toContainText('逾期或停滞');
    await expect(cards.nth(2)).toContainText('9');

    // 蓝灯就是健康态，不应再有一张单独的健康卡
    await expect(page.locator("[data-region='R5'] [data-color='NONE']")).toHaveCount(0);
  });

  /**
   * V-7：冻结数据里的非法状态值已在 fixtures 替换为合法取值。
   *
   * <p>这条断言防的是「照着设计稿把标签改回去」。改回去不会报错、界面也正常，
   * 但前端就出现了状态机里不存在的状态值，STK-1 要防的正是这个。
   */
  test('L2 业务入口卡不出现状态机以外的状态值', async ({ page }) => {
    const entries = page.locator("[data-region='R4'] .entry");
    await expect(entries).toHaveCount(5);

    const text = (await entries.allInnerTexts()).join(' ');
    for (const illegal of ['待澄清', '已下架', '认证讲师', '待认证', '进行中']) {
      expect(text, `不得出现非法状态值「${illegal}」（V-7）`).not.toContain(illegal);
    }
    // 替换后的合法取值应在
    for (const legal of ['已评审', '已关闭', '可上岗', '培养中', '待培养', '执行中']) {
      expect(text).toContain(legal);
    }
  });

  /**
   * 文档 14.1 冻结的五行待办，逐行核对。
   *
   * <p>灯色全部照抄文档——新口径下这五行本来就自洽。唯一的偏离是第 5 行的对象名：
   * 「讲师认证-067」触碰禁区 F-1（V-10），这条也一起锁住，防的是「照文档改回去」。
   */
  test('L2 待办清单五行与文档 14.1 一致', async ({ page }) => {
    const rows = page.locator("[data-region='R6'] tbody tr");
    await expect(rows).toHaveCount(5);

    const expected = [
      { owner: '李明', object: 'AI需求-0987', node: '评审中', deadline: '2024-06-12', days: '2 天' },
      { owner: '王芳', object: '课程-0456', node: '课程开发中', deadline: '2024-06-15', days: '5 天' },
      { owner: '张伟', object: '培训场次-0321', node: '执行准备', deadline: '2024-06-18', days: '8 天' },
      { owner: '陈晨', object: '案例-0188', node: '内容完善', deadline: '2024-06-10', days: '0 天' },
      { owner: '刘洋', object: '讲师-067', node: '入池评审', deadline: '2024-06-20', days: '10 天' },
    ];

    for (const [index, row] of expected.entries()) {
      const cells = rows.nth(index).locator('td');
      /*
       * 责任人列用 data-owner 而不是 toHaveText：单元格里除了姓名还有一个首字圆牌，
       * 取整格文本会读成「李李明」。
       * 圆牌已经 aria-hidden，但 toHaveText 读的是 textContent，不看无障碍属性。
       */
      await expect(rows.nth(index)).toHaveAttribute('data-owner', row.owner);
      await expect(cells.nth(0)).toContainText(row.owner);
      await expect(cells.nth(1)).toHaveText(row.object);
      await expect(cells.nth(2)).toHaveText(row.node);
      await expect(cells.nth(3)).toHaveText(row.deadline);
      await expect(cells.nth(4)).toHaveText(row.days);
      await expect(cells.nth(6)).toHaveText('去处理');
    }

    // 禁区 F-1：平台里没有「讲师认证」这件事（V-10）
    await expect(page.locator("[data-region='R6']")).not.toContainText('讲师认证');

    // 灯色照抄文档 14.1：红／黄／蓝／红／蓝
    const lights = page.locator("[data-region='R6'] tbody [data-testid='warning-light']");
    for (const [index, color] of ['RED', 'YELLOW', 'BLUE', 'RED', 'BLUE'].entries()) {
      await expect(lights.nth(index)).toHaveAttribute('data-color', color);
    }

    // 两行红灯都还没到期（剩余 2 天、0 天），成因只能是状态停滞而不是逾期。
    // 写成「已逾期」会和同一行的「剩余 2 天」直接打脸
    await expect(lights.nth(0)).toHaveText('状态停滞');
    await expect(lights.nth(3)).toHaveText('状态停滞');
    await expect(page.locator("[data-region='R6'] tbody")).not.toContainText('已逾期');

    // 天数只出现在「剩余天数」列，预警灯列不重复一遍（否则 100px 会折行把行高顶起来）
    await expect(lights.first()).not.toContainText('天');
  });

  test('L2 五张入口卡的底部三数都在卡内，没被插画挤出去', async ({ page }) => {
    /*
     * 这条断言防的是一类不报错的回归：插画用 flex:1 吃掉余量，
     * 一旦它的收缩被某个 min-height 或 aspect-ratio 挡住，就会把底部三数顶到卡片外面。
     * 卡片本身仍是 216px、L1 区域断言照样通过，只有那三个数字看不见了 ——
     * 而「入口卡上没有数」和「这个驾驶舱暂时没数据」在界面上长得一模一样。
     */
    const cards = page.locator("[data-region='R4'] [data-testid='dash-entry']");
    await expect(cards).toHaveCount(5);

    const stats = page.locator("[data-region='R4'] [data-testid='entry-stat']");
    // 五张卡各三条。案例卡的后两条属 N18 口径，仅回归模式渲染（V-8），这里正是回归模式
    await expect(stats).toHaveCount(15);

    /*
     * 比的是<b>区域</b>下沿而不是卡片下沿。
     *
     * 第一版这里拿卡片下沿当基准，结果是：卡片被 <img> 撑到 295px，三个统计数
     * 跟着卡片一起长出去，相对卡片仍然「在里面」，断言照过 —— 而它们实际已经落到
     * 下一行区域上、被预警面板盖住了。基准必须是不会跟着一起变形的那个量。
     */
    const region = await page.locator("[data-region='R4']").boundingBox();
    const regionBottom = (region?.y ?? 0) + (region?.height ?? 0);

    for (let index = 0; index < 5; index += 1) {
      const card = await cards.nth(index).boundingBox();
      expect(
        Math.abs((card?.height ?? 0) - 216),
        `第 ${index + 1} 张卡实测高 ${card?.height}px，应为 216px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);

      const lastStat = await stats.nth(index * 3 + 2).boundingBox();
      expect(lastStat, `第 ${index + 1} 张卡的第三个统计取不到 boundingBox`).not.toBeNull();
      const statBottom = (lastStat?.y ?? 0) + (lastStat?.height ?? 0);
      expect(
        statBottom,
        `第 ${index + 1} 张卡的三数底沿 ${statBottom} 越过区域下沿 ${regionBottom}`,
      ).toBeLessThanOrEqual(regionBottom);
    }

    // 徽章与 KPI 同源，对不上会被当成 bug
    await expect(cards.nth(0)).toContainText('1,268');
    await expect(cards.nth(1)).toContainText('842');
    await expect(cards.nth(2)).toContainText('1,236');
    await expect(cards.nth(3)).toContainText('328');
    await expect(cards.nth(4)).toContainText('186');
  });

  test('L2 待办总数在四处一致', async ({ page }) => {
    /*
     * 待办总数在这一屏出现四次：侧栏「任务中心」角标、顶栏「任务」角标、
     * R6 标题旁的计数、欢迎卡的「共 N 项待办需要跟进」。
     *
     * R6 那个计数最容易写成表格行数（冻结数据只有 5 行），于是「待办行动清单 5」
     * 和「共 12 项待办」出现在同一屏上。两个数各自都合理，把它们放在一起读才看得出问题，
     * 所以这里把四处绑在一起。
     */
    const sidebar = await page
      .locator(".shell-nav-item[href='/tasks'] .shell-nav-badge")
      .textContent();
    const topbar = await page
      .locator(".shell-action[href='/tasks'] .shell-action-badge")
      .textContent();
    const panel = await page.locator("[data-region='R6'] .panel-count").textContent();

    expect(topbar, '顶栏与侧栏的任务角标不一致').toBe(sidebar);
    expect(panel, 'R6 标题计数与侧栏角标不一致（很可能写成了表格行数）').toBe(sidebar);
    await expect(page.locator("[data-region='R9']")).toContainText(`共 ${sidebar} 项待办`);
  });

  test('L2 业务价值面板标题不折行', async ({ page }) => {
    // 239px 的窄卡要同时放「业务价值」+「（人工填报）」+「查看明细」，
    // 三者按默认字号合计 216px 会把标题挤成两行，把三条数值往下推出卡外
    const title = page.locator("[data-region='R8'] .panel-title");
    const box = await title.boundingBox();
    expect(box?.height, `标题实测 ${box?.height}px，单行应约 26px`).toBeLessThanOrEqual(28);
  });

  test('L2 效率指标四条，终点值与冻结数据一致', async ({ page }) => {
    const items = page.locator("[data-region='R7'] .efficiency-item");
    await expect(items).toHaveCount(4);

    const expected = [
      ['需求平均评审周期', '5.6 天'],
      ['课程平均开发周期', '28.3 天'],
      ['一次评审通过率', '71.2%'],
      ['案例平均上架周期', '15.8 天'],
    ];
    for (const [index, [label, value]] of expected.entries()) {
      await expect(items.nth(index).locator('.efficiency-label')).toHaveText(label);
      await expect(items.nth(index).locator('.efficiency-value')).toHaveText(value);
    }

    // 四条折线都要真的渲染出来。ECharts 用 SVG renderer，失败时容器是空的
    await expect(page.locator("[data-region='R7'] svg")).toHaveCount(4);

    /*
     * 终点标注（圆点 + 日期 + 当期值）必须画在图里。
     *
     * 这一条不是重复上面的 .efficiency-value 断言：那个读的是图外的大号数字，
     * 而标注在 SVG 内。漏注册 ScatterChart 时整批标注会被 ECharts 静默跳过 ——
     * 折线照画、svg 计数照样是 4、控制台没有任何输出，只有对着设计稿看才发现少了东西。
     */
    for (const [index, [, value]] of expected.entries()) {
      const svg = items.nth(index).locator('svg');
      // textContent 而不是 innerText：SVG 元素不是 HTMLElement，没有 innerText
      const svgText = await svg.textContent();
      expect(svgText, `第 ${index + 1} 张图缺终点标注（应含 ${value}）`).toContain(value);

      /*
       * 标注还要真的看得见。它的锚点在绘图区右边缘，居中对齐时一半会溢出 SVG 被裁掉，
       * 屏幕上是「5.6 ヌ」这种缺字——而 textContent 里的字符串是完整的，
       * 上面那条断言照样通过。所以这里比几何：标注的右沿不得越过 SVG 的右沿。
       */
      const clipped = await svg.evaluate((node, endValue: string) => {
        const label = [...node.querySelectorAll('text, tspan')].find((el) =>
          (el.textContent ?? '').includes(endValue),
        );
        if (!label) return { found: false, overflow: 0 };
        const svgRight = node.getBoundingClientRect().right;
        return { found: true, overflow: label.getBoundingClientRect().right - svgRight };
      }, value);

      expect(clipped.found, `第 ${index + 1} 张图找不到终点标注元素`).toBe(true);
      expect(
        clipped.overflow,
        `第 ${index + 1} 张图的终点标注右溢出 ${clipped.overflow}px，屏幕上会缺字`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }
  });

  test('L2 业务价值三项为人工填报值', async ({ page }) => {
    const region = page.locator("[data-region='R8']");
    await expect(region).toContainText('效率提升');
    await expect(region).toContainText('18.7%');
    await expect(region).toContainText('12.4%');
    await expect(region).toContainText('¥128.6万');
  });
});
