import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 前端状态硬编码门禁（CLAUDE.md STK-1、阶段 2 出口准则 E2-6）。
 *
 * 状态值只能来自后端：对象字段原值、`/api/meta/enums`、`transitions/available` 返回的动作表。
 * 前端写死一个状态名，等于把需求第 5 章的转换表复制了一份到浏览器里——后端改了状态名，
 * 页面不会报错，只会安静地少显示一列、少一个按钮，或者把一个已经不存在的状态画在状态地图上。
 *
 * 设计稿曾出现 8 处状态机里不存在的状态值（试讲「条件通过」、评审「待定」、需求「待澄清」），
 * 这正是 STK-1 存在的原因：连人工设计都会凭印象写出不存在的状态。
 *
 * 状态词表取自需求文档第 5 章的机器解析结果（后端状态机测试用的同一份 CSV），
 * 不在这里另抄一份——那样门禁自己就成了第二处硬编码。
 */

const TRANSITIONS_CSV = resolve(
  process.cwd(),
  '../backend/platform/statemachine/src/test/resources/statemachine/requirement-transitions.csv',
);

/**
 * 允许出现状态值的文件，每条都要写清理由。
 *
 * 空着理由的白名单等于没有门禁：半年后没人分得清哪条是当初想清楚的例外，
 * 哪条是为了让测试变绿顺手加的。
 */
const ALLOWED: Record<string, string> = {
  // 设计规范 2.10 的三组状态标签配色表。配色是设计决策，不可能由后端下发，
  // 因此这张表的键必须是状态值本身。它只做「取值 → 颜色」的查表，认不出的取值直接不渲染，
  // 不参与任何状态判断（见 StatusTag 的注释）
  'src/shared/ui/StatusTag/StatusTag.tsx': '设计规范 2.10 的状态标签配色映射表，键即状态值',
  // 需求 15.1／15.2 定的指标中文名里有几个含状态词（「课程已发布数」「开发中需求数」）。
  // 它们只往指标卡标题上渲染，不做比较、不当查表的键。集中在这一个文件里，
  // 五个驾驶舱页就仍然受门禁保护
  'src/shared/metrics/cockpitMetrics.tsx': '需求 15.x 的指标中文名，只作卡片标题渲染',
  // 需求 9.4 的字段名「自检完成时间」是个日期字段，与课程自检子状态「自检完成」撞了子串。
  // 页里状态一律走 transitions/available（提交评审那段读的是后端下发的 action），
  // 「自检完成时间」只往 Form.Item 的 label 上渲染，不做比较也不当查表的键
  'src/features/course/CourseSelfcheckTab.tsx': '需求 9.4 字段名「自检完成时间」，只作表单标签渲染',
};

/**
 * 整目录豁免：`src/fixtures/**` 是《设计文档 V2.0》的冻结数据。
 *
 * <p>豁免的理由不是「方便」，而是这些文件与被检查的对象<b>不是一类东西</b>。
 * STK-1 防的是前端把状态转换表复制一份到浏览器里 —— 后端改了状态名，页面不报错，
 * 只是安静地少一列、少一个按钮。fixtures 扮演的是<b>后端响应本身</b>：
 * 它替代 `/api` 的返回值，状态值在这里是载荷，和真实响应里的状态值一样。
 * 这与文件级已经豁免的测试文件属同一类 —— 断言「状态变成了『已发布』」本来就该写出那个词。
 *
 * <p>豁免掉的保护由下面第三条断言补回：fixtures 不得出现 V2.0 里那些状态机根本没有的取值。
 * 那才是设计稿真正带来的风险，也是业务裁决 V-7 要求替换的东西。
 */
const ALLOWED_DIRS: Record<string, string> = {
  'src/fixtures': 'V2.0 冻结数据，扮演后端响应；状态值是载荷而非判断逻辑（见 V-7）',
};

/**
 * V2.0 冻结数据里出现过、但 15 个状态机里根本不存在的取值。
 *
 * <p>业务裁决 V-7：fixtures 里一律替换为合法取值。这条清单是防回退用的 ——
 * 照着设计稿把标签改回去不会报错、界面也照常显示，
 * 但前端就出现了状态机里不存在的状态值，正是 STK-1 要防的那件事。
 */
const DESIGN_ONLY_STATES: Record<string, string> = {
  待澄清: '需求评审状态只有 待评审／评审中／已评审',
  已下架: '课程「已下架」永久不做（N4）',
  条件通过: '试讲结论只有 合格／不合格（转换表 5.6，需求 N2／5.5／9.6.1 三处明写不支持有条件通过）',
  未通过: '试讲结论用「不合格」；「未通过」一个字都不出现在任何状态机里',
  待定: '评审结论没有「待定」',
  /*
   * 「认证讲师」指的是指标名「认证讲师数」，需求 15 明写它一期算不出来
   * （N6 不做认证粒度与有效期），替代指标是「可上岗讲师数」（15.1 第 12a 项）。
   *
   * 注意它与认证台账是两件事：台账（dtl_lecturer_certification）记的是运营在编辑页
   * 直接录入的结果——是否认证、认证状态、认证意见都由人填，平台不做判断（原则一）。
   * 所以「待认证／认证中／已认证」是合法取值，不在这张表里；见下面那条交叉验证。
   */
  认证讲师: '指标名「认证讲师数」一期算不出（N6），替代指标是「可上岗讲师数」（15.1 第 12a）',
  // 「进行中」不能进这张表：合法指标名就是「进行中培训场次数」（15.1 第 14 项），
  // 子串命中会把 KPI 标签误杀。场次状态用「已开课」由 p05 spec 的 data-state 断言钉住
  待开始: '培训场次状态用「待开课」；「待开始」一个字都不出现在状态机里',
  审核中: '案例状态用「待审核」；「审核中」不是案例状态机的取值（5.9）',
  阅读量: '指标必须叫「浏览次数」（15.5／12.4）；「阅读量」会让管理层高估推广效果',
};

/**
 * 两字状态值不参与检查。
 *
 * 「开发」「优化」「发布」「推广」会命中大量正常文案：按钮上的「关闭课程开发」、
 * 页面标题里的「课程开发」。把它们一并禁掉的结果是白名单迅速膨胀，门禁退化成摆设。
 * 真正危险的那类写法——把状态名写进条件判断或列定义——用的都是三字以上的状态名。
 */
const MIN_LENGTH = 3;

/**
 * 后端五个业务 Enums 里所有字符串字面量，用来反向验证上面那张黑名单。
 *
 * <p>解析 Java 源码而不是启动后端调接口，理由同 {@code fieldEnumGuard.test.ts}：
 * 门禁必须能在没有数据库、没有容器的环境里跑，否则它进不了 CI。
 */
const ENUM_SOURCES = [
  'business/demand/src/main/java/com/aiacademy/business/demand/domain/DemandEnums.java',
  'business/course/src/main/java/com/aiacademy/business/course/domain/CourseEnums.java',
  'business/training/src/main/java/com/aiacademy/business/training/domain/TrainingEnums.java',
  'business/lecturer/src/main/java/com/aiacademy/business/lecturer/domain/LecturerEnums.java',
  'business/kase/src/main/java/com/aiacademy/business/kase/domain/CaseEnums.java',
];

function backendEnumLiterals(): Set<string> {
  const backend = resolve(process.cwd(), '../backend');
  const values = new Set<string>();
  ENUM_SOURCES.forEach((relativePath) => {
    const source = stripComments(readFileSync(resolve(backend, relativePath), 'utf8'));
    [...source.matchAll(/"([^"]+)"/g)].forEach((match) => {
      if (match[1]) values.add(match[1]);
    });
  });
  return values;
}

function stateValues(): string[] {
  const csv = readFileSync(TRANSITIONS_CSV, 'utf8');
  const values = new Set<string>();

  csv
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() !== '')
    .forEach((line) => {
      // 第 4 列起始状态、第 6 列目标状态。副作用列里有逗号但带引号，
      // 而这两列在它之前，按逗号切就够用
      const cells = line.split(',');
      [cells[3], cells[5]].forEach((cell) => {
        const state = (cell ?? '').trim();
        // 「（新建）」「（空）」是转换表里表达「还没有状态」的写法，不是业务状态值
        if (state.length >= MIN_LENGTH && !state.startsWith('（')) {
          values.add(state);
        }
      });
    });

  return [...values];
}

/**
 * 注释不参与检查。
 *
 * 「当前状态为「已发布」，不允许再提交评审」这种说明是注释该有的样子——它解释的正是
 * 为什么这里不能自己判断状态。把注释也禁掉会逼着代码把话说得含糊。
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    // 测试文件可以写状态值：断言「状态变成了『已发布』」本来就该写出那个词
    const isSource = /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
    return isSource ? [path] : [];
  });
}

describe('STK-1：前端不得写死状态值', () => {
  it('需求第 5 章的状态词表能读到，否则这条门禁什么都没检查', () => {
    expect(stateValues().length).toBeGreaterThan(20);
  });

  it('src 下的源码里不出现任何状态机状态值', () => {
    const states = stateValues();
    const root = resolve(process.cwd(), 'src');
    const violations: string[] = [];

    sourceFiles(root).forEach((file) => {
      const key = relative(process.cwd(), file).replace(/\\/g, '/');
      if (ALLOWED[key]) {
        return;
      }
      if (Object.keys(ALLOWED_DIRS).some((dir) => key.startsWith(`${dir}/`))) {
        return;
      }
      const code = stripComments(readFileSync(file, 'utf8'));
      states.forEach((state) => {
        if (code.includes(state)) {
          violations.push(`${key}：出现状态值「${state}」`);
        }
      });
    });

    expect(
      violations,
      '状态值一律取后端下发的数据：列表列渲染用对象字段原值，可执行动作用 transitions/available，' +
        '状态地图的列用 /api/meta/enums 的状态机定义。确需按状态值配色时加进 ALLOWED 并写明理由。',
    ).toEqual([]);
  });

  /**
   * fixtures 目录整体豁免了状态词表检查，这条把豁免掉的保护补回来。
   *
   * <p>检查方向是反的：不问「有没有出现合法状态值」（那是允许的），
   * 而问「有没有出现设计稿凭印象造出来的状态值」。
   */
  it('V2.0 冻结数据里不得留下状态机以外的状态值（V-7）', () => {
    const root = resolve(process.cwd(), 'src/fixtures');
    const violations: string[] = [];

    sourceFiles(root).forEach((file) => {
      const key = relative(process.cwd(), file).replace(/\\/g, '/');
      const code = stripComments(readFileSync(file, 'utf8'));
      Object.entries(DESIGN_ONLY_STATES).forEach(([state, reason]) => {
        if (code.includes(state)) {
          violations.push(`${key}：出现设计稿独有的状态值「${state}」——${reason}`);
        }
      });
    });

    expect(
      violations,
      '业务裁决 V-7：V2.0 冻结数据里的非法状态值一律替换为状态机的合法取值。' +
        '替换只动标签、不动数字与数字的位置——数字宽度参与像素比对。',
    ).toEqual([]);
  });

  /**
   * 黑名单本身的保鲜期检查：里面的词不得是后端认可的合法取值。
   *
   * <p>{@link DESIGN_ONLY_STATES} 是手工维护的，而它记录的是「某个词在后端不存在」——
   * 这个判断会随后端演进过期，且<b>过期的方向是有害的</b>：门禁会持续拦住一个已经合法的取值，
   * 而失败信息说的是「设计稿凭印象造的状态值」，读的人会照着去改 fixtures，把对的改成错的。
   *
   * <p>真实发生过：「待认证」被列为「讲师认证体系属禁区」，但后来的迁移
   * {@code V5_025__lecturer_cert_and_level.sql} 建了认证台账，
   * {@code LecturerEnums.CERT_STATES} 把 待认证／认证中／已认证 三值作为字段枚举下发。
   * 台账记的是运营在编辑页直接录入的结果（是否认证、认证状态、认证意见都由人填，
   * 平台不做判断——原则一），与 N6 排除的「认证粒度与有效期」不是一回事。
   * 那条黑名单于此失效，却又拦了很久，因为没有任何东西会在它失效时报错。
   */
  it('黑名单里的词都不是后端认可的合法取值', () => {
    const legal = backendEnumLiterals();
    expect(legal.size, '后端 Enums 源码没解析出取值，这条门禁什么都没检查').toBeGreaterThan(50);

    const stale = Object.keys(DESIGN_ONLY_STATES).filter((state) => legal.has(state));

    expect(
      stale,
      '这些词已经是后端下发的合法取值，不该再留在「设计稿独有」黑名单里。\n' +
        '请从 DESIGN_ONLY_STATES 删掉它，并确认对应的 fixtures 用的就是后端那个取值——' +
        '不要反过来去改 fixtures。',
    ).toEqual([]);
  });
});
