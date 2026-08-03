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
 * P04 讲师与能力地图视觉回归（《设计文档 V2.0》第 8 章）。
 *
 * <p>断言顺序按文档 8「页面级验收」：先校 R1/R2，再校正文外框，最后校文字与图表。
 *
 * <p>几何之外钉住五件语义上的事：
 * <ul>
 *   <li>试讲结论只有 合格／不合格，`条件通过` 与 `未通过` 一个都不出现</li>
 *   <li>台账列名不叫「运营结论」，「结论一致」由两列算出而不是第三个字段</li>
 *   <li>讲师卡上没有「信誉度」这种需求里不存在的百分比字段</li>
 *   <li>KPI 用需求 15.3 的官方指标名</li>
 *   <li>「讲师成长建议」只在回归模式渲染（N6）</li>
 * </ul>
 */

/** 文档 8「区域坐标（CSS px）」表。R1/R2 由 expectShellGeometry 覆盖，这里从 R3 起 */
const REGIONS: Region[] = [
  { id: 'R3', name: '四张 KPI', x: 252, y: 64, w: 1150, h: 112 },
  { id: 'R4', name: '筛选器', x: 252, y: 203, w: 812, h: 45 },
  { id: 'R5', name: '讲师池', x: 252, y: 264, w: 812, h: 484 },
  { id: 'R6', name: '试讲台账', x: 252, y: 778, w: 812, h: 178 },
  { id: 'R7', name: '讲师详情', x: 1081, y: 203, w: 481, h: 753 },
];

/** 文档 8「冻结 KPI」表，第四张的标签已按裁决换成需求 15.3 的官方名 */
const KPIS = [
  { id: 'poolSize', label: '讲师池人数', value: '1,268', delta: '↑ 12.5%' },
  { id: 'qualified', label: '试讲合格讲师数', value: '842', delta: '↑ 8.3%' },
  { id: 'monthlyAttendees', label: '本月授课人次', value: '1,236', delta: '↑ 14.7%' },
  { id: 'avgScore', label: '讲师平均评分', value: '4.68', delta: '↑ 0.21' },
];

/** 文档 8「内部几何 / 列宽」标注「必须照抄」的八列，合计 812 = 区域宽 */
const LEDGER_COLUMNS = [
  { id: 'course', label: '课程名称', width: 200 },
  { id: 'round', label: '轮次', width: 90 },
  { id: 'lecturer', label: '讲师', width: 85 },
  { id: 'lecturerConclusion', label: '讲师结论', width: 105 },
  { id: 'courseConclusion', label: '课程结论', width: 105 },
  { id: 'consistent', label: '结论一致', width: 90 },
  { id: 'reviewedAt', label: '评审日期', width: 90 },
  { id: 'action', label: '操作', width: 47 },
];

/** 文档 8「冻结数据」：八张讲师卡的 授课次数 / 平均评分 */
const CARDS = [
  { id: 'JS0431', name: '李玥', teachingCount: '32', avgScore: '4.86' },
  { id: 'JS0387', name: '王宇', teachingCount: '28', avgScore: '4.72' },
  { id: 'JS0356', name: '张伟', teachingCount: '21', avgScore: '4.65' },
  { id: 'JS0402', name: '刘洋', teachingCount: '15', avgScore: '4.32' },
  { id: 'JS0418', name: '陈晨', teachingCount: '26', avgScore: '4.78' },
  { id: 'JS0395', name: '周建', teachingCount: '22', avgScore: '4.69' },
  { id: 'JS0374', name: '黄悦', teachingCount: '18', avgScore: '4.61' },
  { id: 'JS0409', name: '吴迪', teachingCount: '12', avgScore: '4.28' },
];

test.describe('P04 讲师与能力地图', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/lecturers');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'instructor');
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

  test('L1 左栏三个区域与右侧详情同起同止', async ({ page }) => {
    /*
     * 坐标表里 R4 与 R7 的 y 都是 203，R6 与 R7 的底沿都是 956。
     * 这条断言不是重复 L1：区域坐标各测各的，两栏各差 1.5px（都在容差内）时
     * 两栏错开 3px —— 而这一页的两栏之间只有 17px 间距，错开 3px 肉眼可见。
     */
    const filters = await page.locator("[data-region='R4']").boundingBox();
    const ledger = await page.locator("[data-region='R6']").boundingBox();
    const detail = await page.locator("[data-region='R7']").boundingBox();

    expect(
      Math.abs((filters?.y ?? 0) - (detail?.y ?? 0)),
      `筛选器顶沿 ${filters?.y} 与详情顶沿 ${detail?.y} 不齐`,
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    expect(
      Math.abs((ledger?.y ?? 0) + (ledger?.height ?? 0) - ((detail?.y ?? 0) + (detail?.height ?? 0))),
      '台账底沿与详情底沿不齐',
    ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  });

  test('L1 台账八列列宽（文档标注「必须照抄」），合计正好 812', async ({ page }) => {
    const headers = page.locator("[data-region='R6'] thead th");
    await expect(headers).toHaveCount(LEDGER_COLUMNS.length);

    let total = 0;
    for (const [index, column] of LEDGER_COLUMNS.entries()) {
      const header = headers.nth(index);
      await expect(header).toHaveAttribute('data-column', column.id);
      await expect(header).toHaveText(column.label);

      const box = await header.boundingBox();
      total += box?.width ?? 0;
      expect(
        Math.abs((box?.width ?? 0) - column.width),
        `第 ${index + 1} 列「${column.label}」实测 ${box?.width}px，应为 ${column.width}px`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
    }

    // 八列之和等于区域宽，所以表格左右不能留内边距（留了就每列被压 3~4px）
    expect(Math.abs(total - 812), `八列合计 ${total}px，应为 812px`).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
  });

  test('L1 讲师卡内的标签与四行指标都没被压扁', async ({ page }) => {
    /*
     * 卡内五段都是 flex 项，高度写在 flex-basis 上。写成 auto 时它们会<b>被压缩而不是溢出</b>：
     * 20px 的标签行缩成 10px，界面上是「机器学习」被横切掉半截 ——
     * 而区域坐标断言与「内容不溢出区域」两条都照样通过，因为卡片本身仍是 158px。
     */
    const cards = page.locator("[data-region='R5'] [data-testid='lecturer-card']");

    for (let index = 0; index < CARDS.length; index += 1) {
      const card = cards.nth(index);
      const tag = await card.locator('.lct-tag').first().boundingBox();
      expect(
        Math.abs((tag?.height ?? 0) - 20),
        `第 ${index + 1} 张卡的领域标签实测 ${tag?.height}px，应为 20px（被压扁了）`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);

      const rows = card.locator('.lct-metric');
      await expect(rows).toHaveCount(4);
      const heights = await rows.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      for (const [row, height] of heights.entries()) {
        expect(
          Math.abs(height - 16),
          `第 ${index + 1} 张卡第 ${row + 1} 行指标实测 ${height}px，应为 16px`,
        ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);
      }
    }
  });

  test('L2 四张 KPI 用需求 15.3 的官方指标名', async ({ page }) => {
    const cards = page.locator("[data-region='R3'] [data-testid='lecturer-kpi']");
    await expect(cards).toHaveCount(KPIS.length);

    for (const [index, kpi] of KPIS.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute('data-kpi', kpi.id);
      await expect(card).toContainText(kpi.label);
      await expect(card).toContainText(kpi.value);
      await expect(card).toContainText(kpi.delta);
    }

    // 需求全文没有「平均学员评分」这个指标名，官方名是「讲师平均评分」（15.3 指标 3）
    await expect(page.locator("[data-region='R3']")).not.toContainText('平均学员评分');
    // 评分写法：4.68 / 5（设计规范 3.3）
    await expect(cards.nth(3)).toContainText('/ 5');
  });

  test('L2 讲师池八张卡，默认选中李玥且只选中一张', async ({ page }) => {
    const cards = page.locator("[data-region='R5'] [data-testid='lecturer-card']");
    await expect(cards).toHaveCount(CARDS.length);

    for (const [index, card] of CARDS.entries()) {
      const node = cards.nth(index);
      await expect(node).toHaveAttribute('data-lecturer', card.id);
      await expect(node).toContainText(card.name);
      await expect(node.locator("[data-metric='teachingCount']")).toContainText(card.teachingCount);
      await expect(node.locator("[data-metric='avgScore']")).toContainText(card.avgScore);
    }

    const selected = page.locator("[data-region='R5'] [data-testid='lecturer-card'][data-selected='true']");
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-lecturer', 'JS0431');
    // 15 组件矩阵：Card selected 用 aria-current
    await expect(selected).toHaveAttribute('aria-current', 'true');
  });

  test('L2 讲师卡第三行是合法字段「学员人次」，不是需求里不存在的「信誉度」', async ({ page }) => {
    const pool = page.locator("[data-region='R5']");

    /*
     * 需求 10.3 的 15 个讲师字段里没有任何形如信誉度／好评率的百分比，
     * N6 又排除了讲师能力评估模型。设计稿那一行是凭印象画的。
     */
    await expect(pool).not.toContainText('信誉度');
    await expect(pool).not.toContainText('好评率');

    const bars = pool.locator("[data-metric='attendees'] [role='progressbar']");
    await expect(bars).toHaveCount(8);
    // 李玥 2,944 人次，进度条按固定基准 3200 归一
    await expect(bars.nth(0)).toHaveAttribute('aria-valuenow', '2944');
    await expect(bars.nth(0)).toHaveAttribute('aria-valuemax', '3200');
    // 千分位（设计规范 3.3）
    await expect(pool.locator("[data-lecturer='JS0431'] [data-metric='attendees']")).toContainText('2,944');
  });

  test('L2 三个分组：两展开一折叠，折叠组不渲染卡片但人数照显示', async ({ page }) => {
    const groups = page.locator("[data-region='R5'] [data-testid='lecturer-group']");
    await expect(groups).toHaveCount(3);

    const expected = [
      { id: 'ai-basics', domain: '人工智能基础', count: '128 人', expanded: 'true', cards: 4 },
      { id: 'llm-apps', domain: '大模型应用', count: '96 人', expanded: 'true', cards: 4 },
      { id: 'data-viz', domain: '数据分析与可视化', count: '84 人', expanded: 'false', cards: 0 },
    ];

    for (const [index, group] of expected.entries()) {
      const node = groups.nth(index);
      await expect(node).toHaveAttribute('data-group', group.id);
      await expect(node).toHaveAttribute('data-expanded', group.expanded);
      await expect(node).toContainText(group.domain);
      await expect(node).toContainText(group.count);
      await expect(node.locator("[data-testid='lecturer-card']")).toHaveCount(group.cards);
    }

    // 三组之和 308 与池子 1,268 刻意不等：一个讲师可以有多个擅长领域，且只展示三组
    await expect(page.locator("[data-region='R5']")).toContainText('共 1,268 人');
  });

  test('L2 刘洋：试讲合格标记为否 + 培养状态徽章，不出现「条件通过」', async ({ page }) => {
    const card = page.locator("[data-region='R5'] [data-lecturer='JS0402']");

    // 设计稿给他挂的是「条件通过」，那个结论不存在（需求 N2／5.5／9.6.1）
    await expect(card).not.toContainText('条件通过');
    // 徽章位置换成培养状态。三个合法值之一（需求 10.3 字段 8a）
    await expect(card).toContainText('培养中');
    // 他那轮是不合格，所以合格标记是「否」
    await expect(card.locator("[data-metric='trialQualified'] [aria-label='否']")).toHaveCount(1);

    // 其余七张都是合格
    const yes = page.locator("[data-region='R5'] [data-metric='trialQualified'] [aria-label='是']");
    await expect(yes).toHaveCount(7);
  });

  test('L2 台账五行：结论只有 合格／不合格，「结论一致」由两列算出', async ({ page }) => {
    const rows = page.locator("[data-region='R6'] [data-testid='ledger-row']");
    await expect(rows).toHaveCount(5);

    const expected = [
      { course: '大模型应用开发实战', round: '第 2 轮', lecturer: '周建', conclusion: '合格', date: '2024-05-09' },
      { course: '数据分析与可视化', round: '第 1 轮', lecturer: '陈晨', conclusion: '不合格', date: '2024-05-08' },
      { course: '机器学习算法精讲', round: '第 3 轮', lecturer: '李玥', conclusion: '合格', date: '2024-05-08' },
      { course: 'RAG 检索增强实践', round: '第 1 轮', lecturer: '黄悦', conclusion: '不合格', date: '2024-05-07' },
      { course: 'Prompt 工程进阶', round: '第 2 轮', lecturer: '吴迪', conclusion: '不合格', date: '2024-05-06' },
    ];

    for (const [index, row] of expected.entries()) {
      const node = rows.nth(index);
      await expect(node).toContainText(row.course);
      await expect(node).toContainText(row.round);
      await expect(node).toContainText(row.lecturer);
      await expect(node).toContainText(row.date);
      // 两个结论列同值，因此「结论一致」列必然是一致
      await expect(node.locator('.lct-conclusion')).toHaveCount(2);
      await expect(node.locator('.lct-conclusion').nth(0)).toHaveText(row.conclusion);
      await expect(node.locator('.lct-conclusion').nth(1)).toHaveText(row.conclusion);
      await expect(node).toHaveAttribute('data-consistent', 'true');
      await expect(node).toContainText('一致');
    }

    const ledger = page.locator("[data-region='R6']");
    // 设计稿这三个词都不是试讲结论的合法取值
    await expect(ledger).not.toContainText('条件通过');
    await expect(ledger).not.toContainText('未通过');
    // 列名：「运营结论」会被读成运营的意见，实际是课程侧的结论（需求 9.7.1 字段 8）
    await expect(ledger).not.toContainText('运营结论');
    await expect(ledger).toContainText('课程结论');
  });

  test('L2 详情：默认停在试讲记录页签，三轮时间线结论全部合法', async ({ page }) => {
    const detail = page.locator("[data-region='R7']");
    await expect(detail).toContainText('李玥');
    await expect(detail).toContainText('AI研究院 · 高级算法工程师');
    await expect(detail).toContainText('试讲合格');

    const tabs = detail.locator("[data-testid='lecturer-tab']");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(1)).toHaveText('试讲记录');
    await expect(tabs.nth(1)).toHaveAttribute('data-active', 'true');

    // 四个擅长领域 + 一枚折叠计数。「+ 2」不是第五个领域名
    const tags = detail.locator('.lct-detail-domains .lct-tag');
    await expect(tags).toHaveCount(5);
    await expect(tags.nth(4)).toHaveText('+ 2');

    const rounds = detail.locator("[data-testid='trial-round']");
    await expect(rounds).toHaveCount(3);
    await expect(rounds.nth(0)).toContainText('第 3 轮（合格）');
    await expect(rounds.nth(0)).toContainText('2024-05-08');
    await expect(rounds.nth(1)).toContainText('第 2 轮（不合格）');
    await expect(rounds.nth(1)).toContainText('2024-04-22');
    await expect(rounds.nth(2)).toContainText('第 1 轮（不合格）');
    await expect(rounds.nth(2)).toContainText('2024-04-10');

    await expect(detail).not.toContainText('条件通过');
    await expect(detail).not.toContainText('未通过');
    // 试讲记录上的字段是参与人，一期没有「评审人」
    await expect(detail).toContainText('参与人：张小北、周建、黄悦');
    await expect(detail).not.toContainText('评审人');
  });

  test('L2 近期授课记录三条，列名用「场次」而不是「班次」', async ({ page }) => {
    const block = page.locator("[data-region='R7'] [data-testid='teaching-block']");
    const rows = block.locator("[data-testid='teaching-row']");
    await expect(rows).toHaveCount(3);

    await expect(rows.nth(0)).toContainText('大模型原理与应用实战');
    await expect(rows.nth(0)).toContainText('第 12 期');
    await expect(rows.nth(0)).toContainText('2024-05-10');
    await expect(rows.nth(0)).toContainText('4.86');
    await expect(rows.nth(2)).toContainText('机器学习算法精讲');
    await expect(rows.nth(2)).toContainText('4.81');

    // 命名对照表：培训场次 = trainingSession，不用 class／batch
    await expect(block).toContainText('场次');
    await expect(block).not.toContainText('班次');
  });

  test('L2 成长建议区块在回归模式下撑住 R7 的 753px', async ({ page }) => {
    /*
     * 产品模式必须不渲染这一块（需求 N6、10.1：讲师能力评估与培养建议随二期上线），
     * 那一半在 src/pages/v2/LecturerV2Page.test.tsx 里断言 —— 这里改不动模式：
     * isRegressionMode() 在首帧就定格了，摘掉 data-regression 只换 CSS 不换数据源。
     */
    const growth = page.locator("[data-testid='growth-advice']");
    await expect(growth).toHaveCount(1);
    await expect(growth).toContainText('继续保持高质量授课表现');

    // 它是 R7 里最后一块，底沿离面板下沿不该超过一个卡片内边距
    const detail = await page.locator("[data-region='R7']").boundingBox();
    const box = await growth.boundingBox();
    const slack = (detail?.y ?? 0) + (detail?.height ?? 0) - ((box?.y ?? 0) + (box?.height ?? 0));
    expect(slack, `成长建议底沿离详情下沿还有 ${slack}px，R7 底部空了一截`).toBeLessThanOrEqual(24);
    expect(slack, '成长建议越过了详情下沿').toBeGreaterThanOrEqual(-BOUNDARY_TOLERANCE);
  });
});
