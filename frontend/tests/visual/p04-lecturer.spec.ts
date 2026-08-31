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
 * <p>几何之外钉住六件语义上的事：
 * <ul>
 *   <li>试讲结论只有 合格／不合格，`条件通过` 与 `未通过` 一个都不出现</li>
 *   <li>台账列名不叫「运营结论」，「结论一致」由两列算出而不是第三个字段</li>
 *   <li>讲师卡上没有「信誉度」这种需求里不存在的百分比字段</li>
 *   <li>KPI 四张：讲师池人数 / 试讲合格讲师数 / 可上岗讲师数 / 讲师综合评分，均由池子算出</li>
 *   <li>分组是现场口径 D-21 的七类领域，不是设计稿凭印象画的三个</li>
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

/** 讲师池实际人数。分组人数与三张 KPI 都从这个数派生 */
const POOL_SIZE = 60;

/**
 * 顶部四张 KPI。值由 {@code LECTURER_POOL} 算出，这里仍写字面量而不是 import fixture：
 * 断言的意义就在于<b>它是独立算过一遍的第二份答案</b>，
 * 跟着 fixture 一起变的断言，永远不会失败也永远发现不了任何事。
 */
const KPIS = [
  { id: 'poolSize', label: '讲师池人数', value: '60', delta: '↑ 12.5%' },
  { id: 'qualified', label: '试讲合格讲师数', value: '30', delta: '↑ 8.3%' },
  { id: 'readyToTeach', label: '可上岗讲师数', value: '30', delta: '↑ 10.0%' },
  { id: 'avgScore', label: '讲师综合评分', value: '4.47', delta: '↑ 0.21' },
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

/**
 * 文档 8「冻结数据」：八张讲师卡的 授课次数 / 平均评分。
 *
 * <p>池子扩到 60 人后这八位仍在，四项指标逐字未动 —— 它们同时被试讲台账与
 * 授课记录引用，改一处要连带改三处。<b>按 data-lecturer 定位而不是按下标</b>：
 * 现在卡片顺序由领域分组决定，八位散在七个组里，下标已经对不上了。
 */
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

/**
 * 七个领域组与各组人数（现场口径 D-21 的七类，与后端 BusinessDomains.NAMES 同序）。
 *
 * <p>七组之和正好等于池子人数：讲师按 {@code domains[0]} 归组，一人只进一组。
 * 设计稿原先那三组（人工智能基础 128／大模型应用 96／数据分析与可视化 84）
 * 之和 308 与池子 1,268 不等，需要在界面上额外解释一句 —— 现在不需要了。
 */
const GROUPS = [
  { domain: '零售', count: 10 },
  { domain: 'GTM', count: 9 },
  { domain: '电商', count: 9 },
  { domain: 'MKT', count: 8 },
  { domain: '服务', count: 8 },
  { domain: '渠道', count: 8 },
  { domain: '政企', count: 8 },
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
    // 逐张量 60 张会让这条断言跑很久，而压扁是整列一起发生的：取八位熟脸做样本足够
    for (const sample of CARDS) {
      const card = page.locator(`[data-region='R5'] [data-lecturer='${sample.id}']`);
      const tag = await card.locator('.lct-tag').first().boundingBox();
      expect(
        Math.abs((tag?.height ?? 0) - 20),
        `${sample.name} 卡上的领域标签实测 ${tag?.height}px，应为 20px（被压扁了）`,
      ).toBeLessThanOrEqual(BOUNDARY_TOLERANCE);

      const rows = card.locator('.lct-metric');
      await expect(rows).toHaveCount(4);
      const heights = await rows.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      for (const [row, height] of heights.entries()) {
        expect(
          Math.abs(height - 16),
          `${sample.name} 卡第 ${row + 1} 行指标实测 ${height}px，应为 16px`,
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

    // 需求全文没有「平均学员评分」这个指标名；卡上写的是「讲师综合评分」
    await expect(page.locator("[data-region='R3']")).not.toContainText('平均学员评分');
    await expect(page.locator("[data-region='R3']")).not.toContainText('本月授课人次');
    // 评分写法：4.68 / 5（设计规范 3.3）
    await expect(cards.nth(3)).toContainText('/ 5');
  });

  test('L2 讲师池 60 张卡，默认选中李玥且只选中一张', async ({ page }) => {
    const cards = page.locator("[data-region='R5'] [data-testid='lecturer-card']");
    await expect(cards).toHaveCount(POOL_SIZE);

    for (const card of CARDS) {
      const node = page.locator(`[data-region='R5'] [data-lecturer='${card.id}']`);
      await expect(node).toHaveCount(1);
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

  test('L2 每张卡一张自己的照片，60 张互不重复', async ({ page }) => {
    /*
     * 头像是运营用来认人的唯一线索。两种坏法都不会让页面报错：
     * 名录漏了人时那张卡静默回落成首字方块，映射写成按姓名散列时两个人共用一张脸。
     */
    const images = page.locator("[data-region='R5'] [data-testid='lecturer-card'] .v2-avatar-img");
    await expect(images).toHaveCount(POOL_SIZE);

    const sources = await images.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
    expect(new Set(sources).size, '有讲师共用了同一张头像').toBe(POOL_SIZE);
    for (const src of sources) {
      expect(src, `头像路径不在 /assets/avatars 下：${src}`).toMatch(
        /^\/assets\/avatars\/(male|female)_\d{2}\.png$/,
      );
    }
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
    await expect(bars).toHaveCount(POOL_SIZE);
    // 李玥 2,944 人次，进度条按固定基准 3200 归一
    const liyue = pool.locator("[data-lecturer='JS0431'] [data-metric='attendees'] [role='progressbar']");
    await expect(liyue).toHaveAttribute('aria-valuenow', '2944');
    await expect(liyue).toHaveAttribute('aria-valuemax', '3200');
    // 千分位（设计规范 3.3）
    await expect(pool.locator("[data-lecturer='JS0431'] [data-metric='attendees']")).toContainText('2,944');
  });

  test('L2 七个领域组全部展开，各组人数之和等于池子人数', async ({ page }) => {
    const groups = page.locator("[data-region='R5'] [data-testid='lecturer-group']");
    await expect(groups).toHaveCount(GROUPS.length);

    let total = 0;
    for (const [index, group] of GROUPS.entries()) {
      const node = groups.nth(index);
      await expect(node).toHaveAttribute('data-group', `domain-${group.domain}`);
      await expect(node).toHaveAttribute('data-expanded', 'true');
      await expect(node).toContainText(group.domain);
      await expect(node).toContainText(`${group.count} 人`);
      await expect(node.locator("[data-testid='lecturer-card']")).toHaveCount(group.count);
      total += group.count;
    }

    /*
     * 各组之和恰好等于池子人数：讲师按第一个擅长领域归组，一人只进一组。
     * 设计稿原先三组之和 308 而池子写 1,268，那个差额得在界面上解释一句才说得通。
     */
    expect(total, `七组之和 ${total}，应等于池子 ${POOL_SIZE} 人`).toBe(POOL_SIZE);
    await expect(page.locator("[data-region='R5']")).toContainText(`共 ${POOL_SIZE} 人`);

    // 设计稿那三个领域名不在现场口径 D-21 的七类里，一个都不该再出现
    const pool = page.locator("[data-region='R5']");
    await expect(pool).not.toContainText('人工智能基础');
    await expect(pool).not.toContainText('大模型应用');
  });

  test('L2 60 张卡装不进 484px，多出来的在池子内滚动而不是溢出区域', async ({ page }) => {
    /*
     * R5 的高度是设计稿钉死的 484px，而 60 张卡按四列排要 15 行。
     * 这一条确认多出来的高度进了滚动容器 —— 少了 overflow-y 的话，
     * 「内容不溢出区域」那条会因为按裁切盒收口而照样通过，
     * 但界面上第三行往下的卡片是被直接切掉的，滚也滚不出来。
     */
    const body = page.locator("[data-region='R5'] .lct-pool-body");
    const metrics = await body.evaluate((node) => ({
      overflowY: getComputedStyle(node).overflowY,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }));

    expect(metrics.overflowY, '池子没开纵向滚动，装不下的卡片会被直接裁掉').toBe('auto');
    expect(
      metrics.scrollHeight,
      `内容高 ${metrics.scrollHeight} 没超过可视高 ${metrics.clientHeight}，60 张卡不该只占这么点`,
    ).toBeGreaterThan(metrics.clientHeight);
  });

  test('L2 刘洋：试讲合格标记为否 + 培养状态徽章，不出现「条件通过」', async ({ page }) => {
    const card = page.locator("[data-region='R5'] [data-lecturer='JS0402']");

    // 设计稿给他挂的是「条件通过」，那个结论不存在（需求 N2／5.5／9.6.1）
    await expect(card).not.toContainText('条件通过');
    // 徽章位置换成培养状态。三个合法值之一（需求 10.3 字段 8a）
    await expect(card).toContainText('培养中');
    // 他那轮是不合格，所以合格标记是「否」
    await expect(card.locator("[data-metric='trialQualified'] [aria-label='否']")).toHaveCount(1);

    // 池子 60 人里合格 30、未合格 30，与 KPI「试讲合格讲师数」同源同值
    const pool = page.locator("[data-region='R5']");
    await expect(pool.locator("[data-metric='trialQualified'] [aria-label='是']")).toHaveCount(30);
    await expect(pool.locator("[data-metric='trialQualified'] [aria-label='否']")).toHaveCount(30);
  });

  test('L2 台账五行：结论只有 合格／不合格，「结论一致」由两列算出', async ({ page }) => {
    const rows = page.locator("[data-region='R6'] [data-testid='ledger-row']");
    await expect(rows).toHaveCount(5);

    const expected = [
      { course: '经销商赋能体系实战', round: '第 2 轮', lecturer: '周建', conclusion: '合格', date: '2024-05-09' },
      { course: '门店店效数据分析', round: '第 1 轮', lecturer: '陈晨', conclusion: '不合格', date: '2024-05-08' },
      { course: '门店 AI 导购助手实战', round: '第 3 轮', lecturer: '李玥', conclusion: '合格', date: '2024-05-08' },
      { course: '渠道政策解读与落地', round: '第 1 轮', lecturer: '黄悦', conclusion: '不合格', date: '2024-05-07' },
      { course: '政企标案写作进阶', round: '第 2 轮', lecturer: '吴迪', conclusion: '不合格', date: '2024-05-06' },
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
    // 岗位从人物名录取，与讲师卡上的来源部门同源 —— 写死一份会让同一个人在一屏里有两个部门
    await expect(detail).toContainText('市场营销部 · 高级培训经理');
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

    await expect(rows.nth(0)).toContainText('门店 AI 导购助手实战');
    await expect(rows.nth(0)).toContainText('第 12 期');
    await expect(rows.nth(0)).toContainText('2024-05-10');
    await expect(rows.nth(0)).toContainText('4.86');
    await expect(rows.nth(2)).toContainText('门店店效数据分析');
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
