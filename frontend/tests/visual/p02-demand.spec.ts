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
 * P02 AI需求驾驶舱视觉回归（《设计文档 V2.0》第 6 章）。
 *
 * <p>断言顺序按文档 6「页面级验收」：先校 R1/R2，再校正文外框，最后校文字与图表。
 *
 * <p>除几何之外，这里还钉住四件<b>语义</b>上的事——它们是 P02 与 V2.0 表面文字
 * 出入最大的地方，几何对了但语义走回去，等于阶段 3 接后端时又要吵一遍：
 * <ul>
 *   <li>分流出口只有两个合法值，不能冒出第三个</li>
 *   <li>评审列只能出现 待评审／评审中／已评审</li>
 *   <li>出口为空的行，处理状态必须是「—」而不是「未启动」</li>
 *   <li>灯色列必须有文字标签（WV1），且不能出现「绿」</li>
 * </ul>
 */

/** 文档 6「区域坐标（CSS px）」表。R1/R2 由 expectShellGeometry 覆盖，这里从 R3 起 */
const REGIONS: Region[] = [
  { id: 'R3', name: '七张 KPI', x: 222, y: 75, w: 1340, h: 108 },
  { id: 'R4', name: '筛选器', x: 222, y: 201, w: 1340, h: 45 },
  { id: 'R5', name: '需求表格', x: 222, y: 264, w: 884, h: 419 },
  { id: 'R6', name: '分析区', x: 222, y: 700, w: 884, h: 258 },
  { id: 'R7', name: '需求详情', x: 1118, y: 264, w: 446, h: 694 },
];

/** 文档 6「内部几何」：需求表 884px 的十二列宽度，标注为「必须照抄」 */
const TABLE_COLUMN_WIDTHS = [
  { label: '需求ID', width: 95 },
  { label: '需求名称', width: 145 },
  { label: '领域', width: 75 },
  { label: '提出人', width: 60 },
  { label: '负责人', width: 60 },
  { label: '评审状态', width: 78 },
  { label: '分流出口', width: 70 },
  { label: '处理状态', width: 78 },
  { label: '预计完成', width: 98 },
  { label: '灯色', width: 42 },
  { label: '停滞', width: 48 },
  { label: '', width: 35 },
];

/** 文档 6「冻结 KPI」表 */
const KPIS = [
  { id: 'total', label: '需求总数', value: '1,268', delta: '↑ 12.5%' },
  { id: 'pendingReview', label: '待评审', value: '162', delta: '↑ 8.3%' },
  { id: 'reviewing', label: '评审中', value: '214', delta: '↑ 14.7%' },
  { id: 'reviewed', label: '已评审', value: '689', delta: '↑ 7.9%' },
  { id: 'approved', label: '已立项', value: '327', delta: '↑ 20.1%' },
  { id: 'developing', label: '开发中', value: '186', delta: '↑ 15.2%' },
  { id: 'online', label: '已上线', value: '132', delta: '↑ 10.4%' },
];

/** 需求评审状态的全部合法值（需求 5.2.1）。评审列出现别的值就是状态字段串了组 */
const LEGAL_REVIEW_STATES = ['待评审', '评审中', '已评审'];

/** 分流出口的两个合法值（需求 5.2.2：仅此两值，不设第三项、不设「其他」）的短标签 */
const LEGAL_OUTLET_LABELS = ['解决方案', '需求开发'];

test.describe('P02 AI需求驾驶舱', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/demands');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'requirement');
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

  test('L1 需求表十二列列宽（文档标注「必须照抄」）', async ({ page }) => {
    const headers = page.locator("[data-region='R5'] thead th");
    await expect(headers).toHaveCount(TABLE_COLUMN_WIDTHS.length);

    for (const [index, column] of TABLE_COLUMN_WIDTHS.entries()) {
      const header = headers.nth(index);
      if (column.label !== '') {
        await expect(header, `第 ${index + 1} 列应是「${column.label}」`).toHaveText(column.label);
      }
      const box = await header.boundingBox();
      expect(box, `第 ${index + 1} 列取不到 boundingBox`).not.toBeNull();
      expect(
        Math.abs((box?.width ?? 0) - column.width),
        `第 ${index + 1} 列「${column.label}」实测 ${box?.width}px，应为 ${column.width}px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }
  });

  test('L2 七张 KPI 与文档 6「冻结 KPI」一致', async ({ page }) => {
    const cards = page.locator("[data-region='R3'] [data-testid='demand-kpi']");
    await expect(cards).toHaveCount(KPIS.length);

    for (const [index, kpi] of KPIS.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute('data-kpi', kpi.id);
      await expect(card).toContainText(kpi.label);
      await expect(card).toContainText(kpi.value);
      await expect(card).toContainText(kpi.delta);
    }
  });

  test('L2 需求表八行，且分流出口只有两个合法值', async ({ page }) => {
    const rows = page.locator("[data-region='R5'] tbody tr");
    await expect(rows).toHaveCount(8);

    // 文档 14.2 的三个分流值里，「采购/外部」是状态机外的第三个出口，已归入出口二
    await expect(page.locator("[data-region='R5'] tbody")).not.toContainText('采购');
    await expect(page.locator("[data-region='R5'] tbody")).not.toContainText('内部开发');
    await expect(page.locator("[data-region='R5'] tbody")).not.toContainText('复用工具');

    const outlets = page.locator("[data-region='R5'] tbody tr td:nth-child(7)");
    for (let index = 0; index < 8; index += 1) {
      const text = ((await outlets.nth(index).textContent()) ?? '').trim();
      expect(
        text === '—' || LEGAL_OUTLET_LABELS.includes(text),
        `第 ${index + 1} 行分流出口「${text}」不在两个合法值里`,
      ).toBe(true);
    }
  });

  test('L2 需求ID 不截断：列内去掉固定前缀，完整 ID 挂 title', async ({ page }) => {
    const cells = page.locator("[data-region='R5'] tbody tr td:nth-child(1)");

    for (let index = 0; index < 8; index += 1) {
      const cell = cells.nth(index);
      // 95px 的列装不下 13 位 ID（实测 101.94px），所以列内不显示恒为常量的「REQ-」前缀
      await expect(cell).not.toContainText('REQ-');
      await expect(cell).toHaveAttribute('title', /^REQ-\d{4}-\d{4}$/);

      // 真正要防的是<b>截断</b>：文字宽度必须小于内容区宽度，否则 ellipsis 会吃掉尾号，
      // 而尾号正是八行里唯一能区分彼此的部分
      const overflow = await cell.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width - el.clientWidth;
      });
      expect(overflow, `第 ${index + 1} 行 ID 文字比单元格宽 ${overflow}px，会被截断`).toBeLessThan(0);
    }
  });

  test('L2 最长的需求名称不被截断', async ({ page }) => {
    // 「企业培训报表自定义导出」实测 143px，而这一列钉死 145px，留内边距就会截掉最后一个字
    const cell = page.locator("[data-region='R5'] tbody tr:nth-child(7) td:nth-child(2)");
    await expect(cell).toHaveText('企业培训报表自定义导出');

    const overflow = await cell.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().width - el.clientWidth;
    });
    expect(overflow, `最长名称比单元格宽 ${overflow}px，会被截断`).toBeLessThanOrEqual(0);
  });

  test('L2 评审列只出现需求评审状态的三个值', async ({ page }) => {
    const cells = page.locator("[data-region='R5'] tbody tr td:nth-child(6)");
    for (let index = 0; index < 8; index += 1) {
      const text = ((await cells.nth(index).textContent()) ?? '').trim();
      expect(
        LEGAL_REVIEW_STATES.includes(text),
        `第 ${index + 1} 行评审状态「${text}」不是需求评审状态的值（可能是开发状态串了组）`,
      ).toBe(true);
    }
  });

  test('L2 出口为空的行，处理状态是「—」而不是「未启动」', async ({ page }) => {
    const body = page.locator("[data-region='R5'] tbody");
    await expect(body).not.toContainText('未启动');
    await expect(body).not.toContainText('设计中');

    // 第 1、8 行是待评审，出口未定，分流与处理状态两列都该是「—」
    for (const rowIndex of [1, 8]) {
      const row = page.locator(`[data-region='R5'] tbody tr:nth-child(${rowIndex})`);
      await expect(row.locator('td:nth-child(7)')).toHaveText('—');
      await expect(row.locator('td:nth-child(8)')).toHaveText('—');
    }
  });

  test('L2 灯色列带文字标签（WV1），且没有「绿」', async ({ page }) => {
    const body = page.locator("[data-region='R5'] tbody");
    // 三色灯只有蓝黄红三色，14.2 里的「绿」在新口径下就是蓝灯「正常运行」
    await expect(body).not.toContainText('绿');

    const lights = body.locator("[data-testid='warning-light']");
    await expect(lights).toHaveCount(8);

    // 42px 的列宽下用两字标签。纯图标会让该处不满足 WCAG AA（VC2／WV1）
    const expected = ['停滞', '关注', '正常', '关注', '正常', '正常', '正常', '停滞'];
    for (const [index, label] of expected.entries()) {
      await expect(lights.nth(index), `第 ${index + 1} 行灯色标签`).toHaveText(label);
    }

    const colors = ['RED', 'YELLOW', 'BLUE', 'YELLOW', 'BLUE', 'BLUE', 'BLUE', 'RED'];
    for (const [index, color] of colors.entries()) {
      await expect(lights.nth(index)).toHaveAttribute('data-color', color);
    }
  });

  test('L2 默认选中行是 REQ-2024-0822，且只有一行选中', async ({ page }) => {
    const selected = page.locator("[data-region='R5'] tbody tr[data-selected='true']");
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-demand', 'REQ-2024-0822');
  });

  test('L2 详情区默认页签与出口一字段组', async ({ page }) => {
    const detail = page.locator("[data-region='R7']");
    await expect(detail).toContainText('学员能力画像优化需求');

    // 六个页签，默认落在第三个「分流与处理」（文档「默认状态与交互」）
    const tabs = detail.locator("[data-testid='demand-tab']");
    await expect(tabs).toHaveCount(6);
    await expect(tabs.nth(2)).toHaveText('分流与处理');
    await expect(tabs.nth(2)).toHaveAttribute('data-active', 'true');

    // 六个页签必须在一行内。414px 里排六个标签只剩 10px 间距的余量，
    // 折行后第二行会盖住下面的字段区，而页签本身看起来完全正常
    const tabBar = await detail.locator('.dmd-tabs').boundingBox();
    expect(tabBar?.height, `页签条实测 ${tabBar?.height}px，单行应约 30px`).toBeLessThanOrEqual(34);

    // 出口一激活解决方案状态，且「验证通过」不是合法值，已按业务裁决落成「已发布」
    await expect(detail).toContainText('学员画像分析引擎 v2.3');
    await expect(detail).toContainText('已发布');
    await expect(detail).not.toContainText('验证通过');
    // 需求开发状态是出口二专用，出口一的详情里整组不出现
    await expect(detail).not.toContainText('需求开发状态');

    // 两个人各带岗位。岗位不是账号角色 —— 一期没有角色表（禁区第 11 项）
    const people = detail.locator("[data-testid='demand-person']");
    await expect(people).toHaveCount(2);
    await expect(people.nth(0)).toContainText('陈华');
    await expect(people.nth(0)).toContainText('AI平台产品经理');
    await expect(people.nth(1)).toContainText('张小北');
  });

  test('L2 详情区在冻结数据下不需要滚动，需求描述与展开入口都在视野内', async ({ page }) => {
    /*
     * .dmd-detail-body 允许滚动（真实数据下字段值会更长），代价是内容超高时页面
     * 看起来完全正常 —— 只是需求描述莫名只显示一行、「查看更多」整个不见了。
     * 冻结数据是设计稿的那一份，它必须一屏装得下；装不下就是间距或字号出了问题，
     * 而不是「让运营滚一下」。
     */
    const body = page.locator("[data-region='R7'] .dmd-detail-body");
    const scroll = await body.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(
      scroll.scrollHeight - scroll.clientHeight,
      `详情正文内容高 ${scroll.scrollHeight}px，可视区只有 ${scroll.clientHeight}px，底部内容被滚动隐藏`,
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);

    await expect(page.locator("[data-region='R7'] .dmd-desc-more")).toBeVisible();
  });

  test('L2 详情四个按钮排成一行', async ({ page }) => {
    // ActionGuard 会换行（动作名长度由状态机决定，不换行会被面板裁掉）。V2.0 的四个按钮
    // 是一行，换行说明间距或标签宽度超了预算——这一页要按文档排成一行
    const buttons = page.locator("[data-region='R7'] [data-testid='guarded-action']");
    await expect(buttons).toHaveCount(4);

    const tops = await buttons.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().top),
    );
    for (const top of tops) {
      expect(Math.abs(top - tops[0]!), `四个按钮的 top 不一致（${tops.join(', ')}），有按钮换行了`)
        .toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }
  });

  test('L2 详情四个按钮：不可执行的置灰并给出状态原因', async ({ page }) => {
    const actions = page.locator("[data-region='R7'] [data-testid='guarded-action']");
    await expect(actions).toHaveCount(4);

    // 顺序照 V2.0 的四个位置，不按可用性重排
    const order = ['开始评审', '录入评审结论', '关联课程', '一键催办'];
    for (const [index, action] of order.entries()) {
      await expect(actions.nth(index)).toHaveAttribute('data-action', action);
    }

    // 当前行是评审中，「开始评审」不可执行；但它要留在原位置置灰，而不是消失
    await expect(actions.nth(0)).toHaveAttribute('data-state', 'blocked');
    await expect(actions.nth(0)).toBeDisabled();
    await expect(
      page.locator("[data-region='R7'] [data-testid='guarded-action-reason']"),
    ).toHaveAttribute('data-reason', '当前状态为「评审中」，不能再执行「开始评审」');

    for (const index of [1, 2, 3]) {
      await expect(actions.nth(index)).toHaveAttribute('data-state', 'allowed');
      await expect(actions.nth(index)).toBeEnabled();
    }
  });

  test('L2 分析区两张 ECharts 图，漏斗按状态顺序而不是按值排序', async ({ page }) => {
    const charts = page.locator("[data-region='R6'] [role='img']");
    await expect(charts).toHaveCount(2);

    // SVG renderer：图渲染出来了才有 <svg>，Canvas 下这个断言会失败——正是想要的
    await expect(charts.nth(0).locator('svg')).toHaveCount(1);
    await expect(charts.nth(1).locator('svg')).toHaveCount(1);

    // 漏斗段宽用等差展示值画成规整递减形（V-69），真实数量走右边 HTML 图例。
    // 量的是每段梯形的上边：外接矩形会把下沿（=下一段上沿）算进去，相邻两段同宽。
    const widths = await charts.nth(1).locator('svg path').evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const numbers = (node.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
          const points: Array<{ x: number; y: number }> = [];
          for (let i = 0; i + 1 < numbers.length; i += 2) {
            points.push({ x: numbers[i] as number, y: numbers[i + 1] as number });
          }
          if (points.length < 4) return null;
          const top = Math.min(...points.map((point) => point.y));
          const xs = points.filter((point) => point.y - top < 1).map((point) => point.x);
          return { top, width: Math.round(Math.max(...xs) - Math.min(...xs)) };
        })
        .filter((item): item is { top: number; width: number } => item !== null && item.width > 1)
        .sort((a, b) => a.top - b.top)
        .map((item) => item.width),
    );
    expect(widths.length, '漏斗应渲染六段').toBe(6);
    // 规整漏斗：自上而下严格递减。sort 失效按真实值重排时，第三段（已评审 689）会最宽
    expect(
      widths.every((width, index) => index === 0 || width < (widths[index - 1] as number)),
      `六段宽度应严格递减，实测 ${widths.join('/')}`,
    ).toBe(true);

    // 图例按状态推进顺序，数量是真实值（不是展示用的等差）
    const legend = page.locator("[data-testid='demand-funnel-legend-row']");
    await expect(legend).toHaveCount(6);
    await expect(legend.nth(0)).toContainText('待评审');
    await expect(legend.nth(0)).toContainText('162');
    await expect(legend.nth(2)).toContainText('已评审');
    await expect(legend.nth(2)).toContainText('689');
    await expect(legend.nth(5)).toContainText('已上线');
    await expect(legend.nth(5)).toContainText('132');
  });

  test('L2 分页条：第 1 页、10 条/页、总 1,268 条、末页 127', async ({ page }) => {
    const pager = page.locator("[data-region='R5'] .dmd-pager");
    await expect(pager).toContainText('共 1,268 条');
    await expect(pager).toContainText('10 条/页');

    // 当前页高亮在第 1 页
    const current = pager.locator("[data-current='true']");
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('1');

    // 末页号由总数除页大小算出，1268/10 上取整 = 127。写死 127 的话
    // 改页大小会得到一个静默错误的末页号
    const pages = pager.locator('.dmd-pager-page');
    await expect(pages.last()).toHaveText('127');

    await expect(pager).toContainText('跳至');
  });
});
