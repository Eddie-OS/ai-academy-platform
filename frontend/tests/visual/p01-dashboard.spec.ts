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

/**
 * 文档 5「区域坐标（CSS px）」表，按业务改版 V-70 修订。R1/R2 由 expectShellGeometry 覆盖，
 * 这里从 R3 起。
 *
 * <p>两处偏离 V2.0 原表：R3 由六张 KPI 减为五张（撤「课程总数」，外框宽度不变）；
 * R8「业务价值」整区撤销，它的 239px 连同 11px 间距归 R9，于是 R9 从 x=1312 w=250
 * 变成 x=1062 w=500。<b>编号不重排</b>——欢迎卡仍叫 R9，改成 R8 会让文档 5 的坐标表
 * 与代码里的 data-region 对不上号。
 */
const REGIONS: Region[] = [
  { id: 'R3', name: '五张 KPI', x: 242, y: 86, w: 1320, h: 124 },
  { id: 'R4', name: '五张业务入口卡', x: 242, y: 229, w: 1320, h: 216 },
  { id: 'R5', name: '三色灯预警', x: 242, y: 461, w: 499, h: 282 },
  { id: 'R6', name: '待办行动清单', x: 752, y: 461, w: 810, h: 282 },
  { id: 'R7', name: '效率指标', x: 242, y: 758, w: 807, h: 211 },
  { id: 'R9', name: '欢迎卡', x: 1062, y: 758, w: 500, h: 211 },
];

/** V-71b：待办行动清单 810px 七列，左右向中间收（合计仍 810） */
const WORKLIST_COLUMN_WIDTHS = [
  { label: '责任人', width: 152 },
  { label: '业务对象', width: 120 },
  { label: '当前节点', width: 88 },
  { label: '截止日期', width: 118 },
  { label: '剩余天数', width: 88 },
  { label: '预警灯', width: 124 },
  { label: '操作', width: 120 },
];

test.describe('P01 总看板', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'dashboard');
  });

  test('L1 八区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 八区域内容不溢出区域', async ({ page }) => {
    await expectContentWithinRegions(
      page,
      REGIONS.map((region) => region.id),
    );
  });

  test('L1 待办清单七列列宽（V-71 合计 810）', async ({ page }) => {
    const headers = page.locator("[data-region='R6'] thead th");
    await expect(headers).toHaveCount(WORKLIST_COLUMN_WIDTHS.length);

    let sum = 0;
    for (const [index, column] of WORKLIST_COLUMN_WIDTHS.entries()) {
      const header = headers.nth(index);
      await expect(header, `第 ${index + 1} 列应是「${column.label}」`).toHaveText(column.label);
      const box = await header.boundingBox();
      const width = box?.width ?? 0;
      sum += width;
      expect(
        Math.abs(width - column.width),
        `「${column.label}」列宽实测 ${width}，应为 ${column.width}`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }
    expect(Math.abs(sum - 810), `七列合计 ${sum}，应为 810`).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  });

  /** V-70 撤掉了「课程总数」，因此是五项而不是 V2.0 的六项 */
  test('L2 冻结 KPI 五项数值与环比', async ({ page }) => {
    const expected = [
      ['需求总数', '1,268', '↑ 12.5%'],
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

    await expect(page.locator("[data-region='R3']")).not.toContainText('课程总数');
  });

  /**
   * 五张 KPI 与五张入口卡逐列对齐（V-70 第 2 条）。
   *
   * <p>这条断言的对象是<b>两行之间的关系</b>，L1 的区域外框断言看不到它：
   * R3 与 R4 的外框都是 x=242 w=1320，无论里面装五列还是六列都照样通过。
   * 对齐没了的表现是上下两行的竖直分界线错开，第一列几乎看不出、最后一列差 44px。
   */
  test('L1 KPI 与入口卡逐列对齐', async ({ page }) => {
    const kpis = page.locator("[data-region='R3'] .kpi");
    const entries = page.locator("[data-region='R4'] .entry");
    await expect(kpis).toHaveCount(5);
    await expect(entries).toHaveCount(5);

    for (let index = 0; index < 5; index += 1) {
      const kpi = await kpis.nth(index).boundingBox();
      const entry = await entries.nth(index).boundingBox();
      expect(
        Math.abs((kpi?.x ?? 0) - (entry?.x ?? 0)),
        `第 ${index + 1} 列左沿：KPI 在 ${kpi?.x}，入口卡在 ${entry?.x}`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
      expect(
        Math.abs((kpi?.width ?? 0) - (entry?.width ?? 0)),
        `第 ${index + 1} 列宽度：KPI ${kpi?.width}，入口卡 ${entry?.width}`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
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
    /*
     * 合法取值应在。这份清单比 V-70 之前短：课程卡、培训卡、案例卡的底部数已由业务
     * 重新指定口径，「已关闭」「待培养」「执行中」不再出现在这一行上——它们仍是合法状态值，
     * 只是不再是这三张卡展示的东西。
     */
    for (const legal of ['已评审', '可上岗', '培养中', '待试讲']) {
      expect(text).toContain(legal);
    }
  });

  /**
   * 文档 14.1 前五行 + V-71 补的滚动样例。姓名混入三字名，灯色徽章用两字短标签。
   */
  test('L2 待办清单前五行与文档 14.1 一致，且面板可滚动', async ({ page }) => {
    const rows = page.locator("[data-region='R6'] tbody tr");
    await expect(rows).toHaveCount(9);

    const expected = [
      { owner: '李明远', object: 'AI需求-0987', node: '评审中', deadline: '2024-06-12', days: '2 天' },
      { owner: '王晓芳', object: '课程-0456', node: '课程开发中', deadline: '2024-06-15', days: '5 天' },
      { owner: '张伟强', object: '培训场次-0321', node: '执行准备', deadline: '2024-06-18', days: '8 天' },
      { owner: '陈晨', object: '案例-0188', node: '内容完善', deadline: '2024-06-10', days: '0 天' },
      { owner: '刘洋', object: '讲师-067', node: '入池评审', deadline: '2024-06-20', days: '10 天' },
    ];

    for (const [index, row] of expected.entries()) {
      const cells = rows.nth(index).locator('td');
      /*
       * 责任人列用 data-owner 而不是 toHaveText：单元格里除了姓名还有一个首字圆牌，
       * 取整格文本会读成「李李明远」。
       */
      await expect(rows.nth(index)).toHaveAttribute('data-owner', row.owner);
      await expect(cells.nth(0)).toContainText(row.owner);
      await expect(cells.nth(1)).toHaveText(row.object);
      await expect(cells.nth(2)).toHaveText(row.node);
      await expect(cells.nth(3)).toHaveText(row.deadline);
      await expect(cells.nth(4)).toHaveText(row.days);
      await expect(cells.nth(6)).toHaveText('去处理');
    }

    // 三字名完整可见，不被 ellipsis 裁成「李明…」（V-71）
    for (const name of ['李明远', '王晓芳', '张伟强', '周立伟', '郑海涛']) {
      const nameBox = await page
        .locator(`[data-region='R6'] [data-owner='${name}'] .worklist-owner-name`)
        .boundingBox();
      expect(nameBox, `${name} 应在责任人列内`).toBeTruthy();
      const clipped = await page
        .locator(`[data-region='R6'] [data-owner='${name}'] .worklist-owner-name`)
        .evaluate((node) => node.scrollWidth > node.clientWidth + 1);
      expect(clipped, `${name} 被裁切了`).toBe(false);
    }

    // 禁区 F-1：平台里没有「讲师认证」这件事（V-10）
    await expect(page.locator("[data-region='R6']")).not.toContainText('讲师认证');
    await expect(page.locator("[data-region='R6']")).not.toContainText('测试人员');

    // 前五行灯色照抄文档 14.1：红／黄／蓝／红／蓝；徽章用两字短标签
    const lights = page.locator("[data-region='R6'] tbody [data-testid='warning-light']");
    for (const [index, color] of ['RED', 'YELLOW', 'BLUE', 'RED', 'BLUE'].entries()) {
      await expect(lights.nth(index)).toHaveAttribute('data-color', color);
    }
    await expect(lights.nth(0)).toHaveText('停滞');
    await expect(lights.nth(3)).toHaveText('停滞');
    await expect(page.locator("[data-region='R6'] tbody")).not.toContainText('已逾期');
    await expect(lights.first()).not.toContainText('天');

    // 行数超出可视区 → 滚动容器可滚（V-71：清单不再是死的）
    const scrollable = await page.locator("[data-testid='worklist-scroll']").evaluate((node) => {
      return node.scrollHeight > node.clientHeight + 1;
    });
    expect(scrollable, '待办清单应出现纵向滚动').toBe(true);

    // 行高约一半：首行高度不得再被 flex 拉到 40px 以上
    const rowBox = await rows.first().boundingBox();
    expect(rowBox?.height ?? 99).toBeLessThanOrEqual(32);
  });

  test('L2 五张入口卡的底部数都在卡内，没被插画挤出去', async ({ page }) => {
    /*
     * 这条断言防的是一类不报错的回归：插画用 flex:1 吃掉余量，
     * 一旦它的收缩被某个 min-height 或 aspect-ratio 挡住，就会把底部数顶到卡片外面。
     * 卡片本身仍是 216px、L1 区域断言照样通过，只有那几个数字看不见了 ——
     * 而「入口卡上没有数」和「这个驾驶舱暂时没数据」在界面上长得一模一样。
     */
    const cards = page.locator("[data-region='R4'] [data-testid='dash-entry']");
    await expect(cards).toHaveCount(5);

    // V-70 起条数逐卡不同：需求／课程／讲师各三条，培训／案例各两条，合计 13
    const perCard = [3, 3, 3, 2, 2];
    const stats = page.locator("[data-region='R4'] [data-testid='entry-stat']");
    await expect(stats).toHaveCount(perCard.reduce((sum, count) => sum + count, 0));

    /*
     * 比的是<b>区域</b>下沿而不是卡片下沿。
     *
     * 第一版这里拿卡片下沿当基准，结果是：卡片被 <img> 撑到 295px，三个统计数
     * 跟着卡片一起长出去，相对卡片仍然「在里面」，断言照过 —— 而它们实际已经落到
     * 下一行区域上、被预警面板盖住了。基准必须是不会跟着一起变形的那个量。
     */
    const region = await page.locator("[data-region='R4']").boundingBox();
    const regionBottom = (region?.y ?? 0) + (region?.height ?? 0);

    let cursor = 0;
    for (const [index, count] of perCard.entries()) {
      const card = await cards.nth(index).boundingBox();
      expect(
        Math.abs((card?.height ?? 0) - 216),
        `第 ${index + 1} 张卡实测高 ${card?.height}px，应为 216px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);

      const lastStat = await stats.nth(cursor + count - 1).boundingBox();
      expect(lastStat, `第 ${index + 1} 张卡的末位统计取不到 boundingBox`).not.toBeNull();
      const statBottom = (lastStat?.y ?? 0) + (lastStat?.height ?? 0);
      expect(
        statBottom,
        `第 ${index + 1} 张卡的底部数底沿 ${statBottom} 越过区域下沿 ${regionBottom}`,
      ).toBeLessThanOrEqual(regionBottom);
      cursor += count;
    }

    /*
     * V-70 撤掉了标题右侧的总量徽章。它显示的是该驾驶舱对应的那张 KPI，
     * 与 R3 那一行重复同一个数；这里反过来锁住「不要把它加回来」。
     */
    await expect(page.locator("[data-region='R4'] .entry-badge")).toHaveCount(0);
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

  /**
   * V-70 撤销了 R8「业务价值」整区，这里锁住它不被加回来。
   *
   * <p>撤区的连带后果是业务价值填报页 /value-reports 失去了唯一入口
   * （它在 navigation.ts 里 inSidebar:false，原先只能从这张卡的「查看明细」进）。
   * 新入口待业务指定，见待修清单 V-70-a。
   */
  test('L2 业务价值区已撤销', async ({ page }) => {
    await expect(page.locator("[data-region='R8']")).toHaveCount(0);
    await expect(page.locator('.dash-row-bottom > .panel')).toHaveCount(2);
    await expect(page.locator('.dash')).not.toContainText('业务价值');
  });

  test('L2 效率指标四条，终点值与冻结数据一致', async ({ page }) => {
    const items = page.locator("[data-region='R7'] .efficiency-item");
    await expect(items).toHaveCount(4);

    // 第三条按需求 7.7 的原名叫「课程一次评审通过率」；V2.0 的卡面省了「课程」两字（V-70）
    const expected = [
      ['需求平均评审周期', '5.6 天'],
      ['课程平均开发周期', '28.3 天'],
      ['课程一次评审通过率', '71.2%'],
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

  /**
   * 待办清单七格文字之间要留出间隔（V-70 第 8 条）。
   *
   * <p>七列列宽是文档 5 标注「必须照抄」的固定值，所以放宽间距只能靠格内的横向内边距，
   * 而那不会改列宽——上面的 L1 列宽断言与这一条互不冲突，两条必须同时成立。
   * 原先横向内边距是 0，「2024-06-12」的末位紧挨下一列「10 天」的首位。
   */
  test('L2 待办清单相邻两格的文字之间留有间隔', async ({ page }) => {
    const cells = page.locator("[data-region='R6'] tbody tr").first().locator('td');
    const count = await cells.count();

    // 末格不算：它已经贴着卡片右沿，留内边距反而让「操作」列比其余六列往里缩一档
    for (let index = 0; index < count - 1; index += 1) {
      const pad = await cells
        .nth(index)
        .evaluate((node) => parseFloat(getComputedStyle(node).paddingRight));
      expect(
        pad,
        `第 ${index + 1} 格的右内边距是 ${pad}px，相邻两列的文字会首尾相接`,
      ).toBeGreaterThanOrEqual(8);
    }
  });
});
