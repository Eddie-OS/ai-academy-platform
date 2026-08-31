/**
 * P04 讲师与能力地图的冻结数据（《设计文档 V2.0》第 8 章）。
 *
 * <h3>逐条替换清单（业务已裁决）</h3>
 *
 * | V2.0 原值 | 替换为 | 依据 |
 * |---|---|---|
 * | 试讲结论「通过／未通过」 | 「合格／不合格」 | 转换表 5.6 第 52～53 行与需求 9.7.1 只有这两个值。`未通过` 一个字都不出现在任何状态机里 |
 * | 试讲结论「条件通过」 | 「不合格」 | 需求 N2、5.5、9.6.1 三处明写「不支持有条件通过」。设计稿里它成对出现（讲师结论与课程结论同为条件通过），一起换成不合格后「结论一致」列不受影响 |
 * | 台账列「运营结论」 | 「课程结论」 | 需求 9.7.1 字段 8 叫「课程试讲结论」。`运营结论` 会被读成「运营的意见」，实际是课程侧的结论；全称 105px 放不下 |
 * | 台账列「是否一致」 | 「结论一致」 | 对应字段是布尔「结论不一致标记」（9.7.1 字段 10），不是一个可选是／否的问题 |
 * | 讲师卡「信誉度 92%」 | 「学员人次」 | 需求 10.3 的 15 个讲师字段里<b>没有</b>任何形如信誉度／好评率的百分比，N6 又排除了讲师能力评估模型。换成合法字段 12「累计学员人次」，进度条按固定基准归一 —— 归一是纯展示换算，不是新指标 |
 * | KPI「平均学员评分」 | 「讲师综合评分」 | 数值仍按需求 15.3 指标 3 的池子均分；卡上不再写「平均」以免和「综合」打架。`平均学员评分` 在需求全文里不存在 |
 * | KPI「本月授课人次」 | 「可上岗讲师数」 | 需求 15.1 指标 12a。试讲合格是标记，可上岗是培养状态，两张卡并存 |
 * | 刘洋卡上的「条件通过」徽章 | 培养状态「培养中」 | 徽章位置需要一个合法语义。同时刘洋的试讲合格标记改为「否」—— 他那轮是不合格 |
 * | 详情「讲师成长建议」区块 | 仅回归模式渲染 | N6 与需求 10.1：讲师能力地图与培养建议随二期上线。口径与 V-8（P06 组织覆盖区）完全一致 |
 * | 时间线「评审人」 | 「参与人」 | 试讲记录上的字段是 participants（TrialLedgerRow），一期没有「评审人」这个字段 |
 * | 讲师池 1,268 人、三组 128／96／84 | <b>60 人、七组按领域实分</b> | 见下 |
 *
 * <h3>为什么讲师池从 1,268 人改成 60 人</h3>
 *
 * 1,268 是设计稿的冻结数，库里从来没有这么多讲师（造数是 20 条）。<b>数字与
 * 人脸不能同时是假的</b>：头像接进来之后，「共 1,268 人」下面只铺 8 张卡，
 * 读起来就是「另外 1,260 人加载失败了」。
 *
 * <p>现在池子人数、试讲合格数、可上岗数、综合评分四张 KPI <b>全部由 {@link LECTURER_POOL} 算出</b>，
 * 不再写字面量。改一条讲师数据，四张卡跟着变 —— 写死的话，改完数据 KPI 不会报错，
 * 只会静默地不再等于池子里的实际人数。
 *
 * <h3>分组改成七大领域，池子内滚动</h3>
 *
 * 原先三组是设计稿凭印象画的领域名（人工智能基础／大模型应用／数据分析与可视化），
 * 与现场口径 D-21 的七类领域不是一套。现在按七类实分，60 人全部渲染，
 * R5 区域高度仍是设计稿的 484px，装不下的部分靠池子内滚动 ——
 * 这与待办清单 V-71 给 P01 待办区的处理同一套做法，视觉断言按裁切盒收口，
 * 滚动内容不算「越过区域下沿」。
 *
 * <p>各组人数之和正好 60：一个讲师可以挂多个擅长领域，但<b>只按第一个领域分组</b>，
 * 因此不再出现「三组之和 308 而池子 1,268」那种需要额外解释的差额。
 */

import { withCurrentDates } from './fixtureClock';
import { avatarUrlOf, personByName } from './people';

/**
 * 七大领域（现场口径 D-21），与后端 {@code BusinessDomains.NAMES} 同序。
 *
 * <p>顺序即讲师池的分组顺序，也与 P02 领域柱图（{@code DEMAND_DOMAIN_BARS}）一致。
 */
export const LECTURER_DOMAINS = ['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'] as const;

export type LecturerDomain = (typeof LECTURER_DOMAINS)[number];

/**
 * 讲师卡的第三行取「累计学员人次」，进度条按这个值归一。
 *
 * <p>取 3200 而不是本组最大值：按本组最大值归一时，每组都必然有一张 100% 的满格卡 ——
 * 读起来像「这个人达标了」，而它其实只表示「他是本组最多的」。
 * 固定基准让全部卡片的条长可以横向比较。
 */
export const ATTENDEE_SCALE = 3200;

export interface LecturerCard {
  /** 讲师ID。需求 10.3 字段 1：JS + 4 位流水 */
  id: string;
  name: string;
  /** 来源部门。V1.2 起是自由文本，不再挂组织架构（禁区第 12 项） */
  dept: string;
  /** 擅长领域，多选。第一个决定分组，卡片只放前两个 */
  domains: string[];
  /** 试讲合格标记（需求 10.3 字段 9），布尔 */
  trialQualified: boolean;
  /** 培养状态。合格者已可上岗不再挂徽章，只有未合格的人需要说明「他在哪一档」 */
  cultivationStatus?: string;
  /** 累计授课次数（字段 11） */
  teachingCount: number;
  /** 平均评分（字段 13）。1.0–5.0，1 位小数；R10：仅正式培训反馈，试讲不计入 */
  avgScore: string;
  /** 累计学员人次（字段 12）。进度条按 ATTENDEE_SCALE 归一 */
  attendees: number;
}

export interface LecturerGroup {
  id: string;
  /** 擅长领域名。现场口径 D-21 七类之一 */
  domain: string;
  /** 该领域的讲师数。由组内卡片数算出，不写字面量 */
  count: number;
  expanded: boolean;
  cards: LecturerCard[];
}

/**
 * 60 名讲师。姓名与部门取自 {@link personByName} 的人物名录，一人一张头像。
 *
 * <p>八位「熟脸」（李玥 JS0431、王宇 JS0387、张伟 JS0356、刘洋 JS0402、陈晨 JS0418、
 * 周建 JS0395、黄悦 JS0374、吴迪 JS0409）的四项指标<b>与设计稿冻结值逐字相同</b>——
 * 它们同时被 P04 视觉回归与试讲台账、授课记录引用，动了会连带打穿三处。
 *
 * <p>试讲合格 30 人、未合格 30 人。未合格的挂培养中或待培养，
 * 「合格标记为否但仍在培养中」这个组合是常态，不是数据错误。
 */
export const LECTURER_POOL: LecturerCard[] = [
  // ---- 零售 10 ----
  { id: 'JS0431', name: '李玥', dept: '市场营销部', domains: ['零售', 'MKT'], trialQualified: true, teachingCount: 32, avgScore: '4.86', attendees: 2944 },
  { id: 'JS0355', name: '王芳', dept: '零售运营部', domains: ['零售', '服务'], trialQualified: true, teachingCount: 24, avgScore: '4.70', attendees: 2688 },
  { id: 'JS0412', name: '周雯', dept: '零售运营部', domains: ['零售'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 9, avgScore: '4.35', attendees: 1980 },
  { id: 'JS0338', name: '李华', dept: '零售运营部', domains: ['零售', 'GTM'], trialQualified: true, teachingCount: 27, avgScore: '4.74', attendees: 2820 },
  { id: 'JS0447', name: '何静', dept: '零售运营部', domains: ['零售'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 6, avgScore: '4.18', attendees: 1520 },
  { id: 'JS0369', name: '徐婕', dept: '零售运营部', domains: ['零售', '电商'], trialQualified: true, teachingCount: 19, avgScore: '4.62', attendees: 2510 },
  { id: 'JS0424', name: '梁颖', dept: '零售运营部', domains: ['零售'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 14, avgScore: '4.48', attendees: 2180 },
  { id: 'JS0391', name: '曹丹', dept: '零售运营部', domains: ['零售', '服务'], trialQualified: true, teachingCount: 21, avgScore: '4.66', attendees: 2600 },
  { id: 'JS0308', name: '胡军', dept: '客户服务部', domains: ['零售'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 11, avgScore: '4.40', attendees: 2050 },
  { id: 'JS0456', name: '孙倩', dept: '市场营销部', domains: ['零售', 'MKT'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 8, avgScore: '4.26', attendees: 1760 },

  // ---- GTM 9 ----
  { id: 'JS0387', name: '王宇', dept: '客户服务部', domains: ['GTM', '服务'], trialQualified: true, teachingCount: 28, avgScore: '4.72', attendees: 2816 },
  { id: 'JS0342', name: '李明', dept: 'GTM策略部', domains: ['GTM', '零售'], trialQualified: true, teachingCount: 26, avgScore: '4.75', attendees: 2790 },
  { id: 'JS0405', name: '高翔', dept: 'GTM策略部', domains: ['GTM'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 10, avgScore: '4.38', attendees: 1920 },
  { id: 'JS0371', name: '马超', dept: 'GTM策略部', domains: ['GTM', 'MKT'], trialQualified: true, teachingCount: 17, avgScore: '4.58', attendees: 2440 },
  { id: 'JS0438', name: '唐睿', dept: 'GTM策略部', domains: ['GTM'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 7, avgScore: '4.22', attendees: 1650 },
  { id: 'JS0316', name: '董浩', dept: 'GTM策略部', domains: ['GTM', '电商'], trialQualified: true, teachingCount: 23, avgScore: '4.68', attendees: 2650 },
  { id: 'JS0459', name: '蒋成', dept: 'GTM策略部', domains: ['GTM'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 5, avgScore: '4.12', attendees: 1380 },
  { id: 'JS0383', name: '袁琪', dept: 'GTM策略部', domains: ['GTM', 'MKT'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 13, avgScore: '4.45', attendees: 2120 },
  { id: 'JS0328', name: '赵璐', dept: '政企客户部', domains: ['GTM', '政企'], trialQualified: true, teachingCount: 20, avgScore: '4.64', attendees: 2570 },

  // ---- 电商 9 ----
  { id: 'JS0356', name: '张伟', dept: '零售运营部', domains: ['电商', '零售'], trialQualified: true, teachingCount: 21, avgScore: '4.65', attendees: 2688 },
  { id: 'JS0399', name: '陈华', dept: '电商运营部', domains: ['电商'], trialQualified: true, teachingCount: 25, avgScore: '4.71', attendees: 2740 },
  { id: 'JS0344', name: '张婧', dept: '电商运营部', domains: ['电商', 'MKT'], trialQualified: true, teachingCount: 16, avgScore: '4.55', attendees: 2390 },
  { id: 'JS0417', name: '吴悦', dept: '电商运营部', domains: ['电商'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 9, avgScore: '4.32', attendees: 1870 },
  { id: 'JS0362', name: '朱琳', dept: '电商运营部', domains: ['电商', '服务'], trialQualified: true, teachingCount: 18, avgScore: '4.60', attendees: 2480 },
  { id: 'JS0429', name: '郭蕊', dept: '电商运营部', domains: ['电商'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 6, avgScore: '4.20', attendees: 1560 },
  { id: 'JS0375', name: '宋佳', dept: '电商运营部', domains: ['电商', '渠道'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 12, avgScore: '4.42', attendees: 2080 },
  { id: 'JS0334', name: '徐涛', dept: '电商运营部', domains: ['电商'], trialQualified: true, teachingCount: 22, avgScore: '4.67', attendees: 2620 },
  { id: 'JS0451', name: '罗宇', dept: '渠道管理部', domains: ['电商', '渠道'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 4, avgScore: '4.08', attendees: 1240 },

  // ---- MKT 8 ----
  { id: 'JS0418', name: '陈晨', dept: 'GTM策略部', domains: ['MKT', 'GTM'], trialQualified: true, teachingCount: 26, avgScore: '4.78', attendees: 2880 },
  /* 设计稿给刘洋挂了一枚「条件通过」徽章。那个结论不存在，他那轮就是不合格，
     所以合格标记为否；徽章位置换成培养状态 —— 不合格但仍在培养中是常态 */
  { id: 'JS0402', name: '刘洋', dept: '市场营销部', domains: ['MKT', '电商'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 15, avgScore: '4.32', attendees: 2432 },
  { id: 'JS0367', name: '孙悦', dept: '市场营销部', domains: ['MKT'], trialQualified: true, teachingCount: 19, avgScore: '4.61', attendees: 2520 },
  { id: 'JS0433', name: '陈曦', dept: '市场营销部', domains: ['MKT', '零售'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 11, avgScore: '4.41', attendees: 2010 },
  { id: 'JS0311', name: '林娜', dept: '市场营销部', domains: ['MKT'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 8, avgScore: '4.28', attendees: 1790 },
  { id: 'JS0396', name: '罗欣', dept: '市场营销部', domains: ['MKT', '服务'], trialQualified: true, teachingCount: 17, avgScore: '4.57', attendees: 2420 },
  { id: 'JS0442', name: '冯瑶', dept: '市场营销部', domains: ['MKT'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 5, avgScore: '4.15', attendees: 1420 },
  { id: 'JS0323', name: '唐雨', dept: '渠道管理部', domains: ['MKT', '渠道'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 14, avgScore: '4.50', attendees: 2230 },

  // ---- 服务 8 ----
  { id: 'JS0395', name: '周建', dept: '渠道管理部', domains: ['服务', '渠道'], trialQualified: true, teachingCount: 22, avgScore: '4.69', attendees: 2784 },
  { id: 'JS0358', name: '郭峰', dept: '客户服务部', domains: ['服务'], trialQualified: true, teachingCount: 24, avgScore: '4.73', attendees: 2700 },
  { id: 'JS0421', name: '宋涛', dept: '客户服务部', domains: ['服务'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 10, avgScore: '4.36', attendees: 1950 },
  { id: 'JS0379', name: '冯凯', dept: '客户服务部', domains: ['服务', '零售'], trialQualified: true, teachingCount: 18, avgScore: '4.59', attendees: 2460 },
  { id: 'JS0446', name: '袁通', dept: '客户服务部', domains: ['服务'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 7, avgScore: '4.24', attendees: 1680 },
  { id: 'JS0332', name: '董岚', dept: '客户服务部', domains: ['服务', 'MKT'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 13, avgScore: '4.47', attendees: 2150 },
  { id: 'JS0408', name: '韩雪', dept: '数据合规部', domains: ['服务', '政企'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 9, avgScore: '4.30', attendees: 1840 },
  { id: 'JS0365', name: '朱斌', dept: '政企客户部', domains: ['服务', '政企'], trialQualified: true, teachingCount: 20, avgScore: '4.63', attendees: 2540 },

  // ---- 渠道 8 ----
  { id: 'JS0374', name: '黄悦', dept: '政企客户部', domains: ['渠道', '政企'], trialQualified: true, teachingCount: 18, avgScore: '4.61', attendees: 2656 },
  { id: 'JS0349', name: '林锋', dept: '渠道管理部', domains: ['渠道'], trialQualified: true, teachingCount: 23, avgScore: '4.70', attendees: 2670 },
  { id: 'JS0414', name: '程斌', dept: '渠道管理部', domains: ['渠道'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 11, avgScore: '4.39', attendees: 1990 },
  { id: 'JS0386', name: '许铭', dept: '渠道管理部', domains: ['渠道', 'GTM'], trialQualified: true, teachingCount: 16, avgScore: '4.54', attendees: 2350 },
  { id: 'JS0453', name: '赵敏', dept: '渠道管理部', domains: ['渠道'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 6, avgScore: '4.19', attendees: 1580 },
  { id: 'JS0319', name: '马蕾', dept: '政企客户部', domains: ['渠道', '政企'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 12, avgScore: '4.44', attendees: 2100 },
  { id: 'JS0392', name: '何勇', dept: '数据合规部', domains: ['渠道', '服务'], trialQualified: true, teachingCount: 15, avgScore: '4.52', attendees: 2280 },
  { id: 'JS0437', name: '梁毅', dept: '数据合规部', domains: ['渠道'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 4, avgScore: '4.10', attendees: 1300 },

  // ---- 政企 8 ----
  { id: 'JS0409', name: '吴迪', dept: '数据合规部', domains: ['政企', '服务'], trialQualified: true, teachingCount: 12, avgScore: '4.28', attendees: 2304 },
  { id: 'JS0352', name: '周强', dept: '数据合规部', domains: ['政企'], trialQualified: true, teachingCount: 21, avgScore: '4.66', attendees: 2580 },
  { id: 'JS0426', name: '刘敏', dept: '政企客户部', domains: ['政企'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 8, avgScore: '4.27', attendees: 1720 },
  { id: 'JS0381', name: '高萌', dept: '政企客户部', domains: ['政企'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 14, avgScore: '4.49', attendees: 2200 },
  { id: 'JS0443', name: '许晴', dept: '政企客户部', domains: ['政企'], trialQualified: false, cultivationStatus: '待培养', teachingCount: 5, avgScore: '4.14', attendees: 1360 },
  { id: 'JS0337', name: '张小北', dept: '客户服务部', domains: ['政企', '服务'], trialQualified: true, teachingCount: 17, avgScore: '4.56', attendees: 2400 },
  { id: 'JS0398', name: '曹阳', dept: '数据合规部', domains: ['政企'], trialQualified: false, cultivationStatus: '培养中', teachingCount: 10, avgScore: '4.34', attendees: 1900 },
  { id: 'JS0458', name: '韩烨', dept: '数据合规部', domains: ['政企'], trialQualified: true, teachingCount: 19, avgScore: '4.58', attendees: 2470 },
];

/** 千分位整数（设计规范 3.3） */
function thousands(value: number): string {
  return value.toLocaleString('en-US');
}

/** 试讲合格人数（需求 15.1 指标 12）。KPI 与卡片读同一份数据，不会各自漂 */
export const LECTURER_QUALIFIED_COUNT = LECTURER_POOL.filter((card) => card.trialQualified).length;

/**
 * 可上岗：培养状态写了「可上岗」，或未写培养状态且已试讲合格。
 *
 * <p>合格者默认已可上岗、卡上不挂徽章（见 {@link LecturerCard.cultivationStatus}）。
 * 口径对应需求 15.1 指标 12a，和「试讲合格」不是同一列 —— 合格只是标记，上岗是培养状态。
 */
export function lecturerIsReadyToTeach(card: LecturerCard): boolean {
  if (card.cultivationStatus) return card.cultivationStatus === '可上岗';
  return card.trialQualified;
}

/** 可上岗人数（需求 15.1 指标 12a） */
export const LECTURER_READY_COUNT = LECTURER_POOL.filter(lecturerIsReadyToTeach).length;

/**
 * 讲师综合评分。数值按需求 15.3 指标 3 的池子均分。
 *
 * <p>算出来而不是抄设计稿的 4.68：抄的话，哪天改了某个讲师的评分，
 * 这张 KPI 不会跟着变，而「一池 4.1 分的讲师顶着 4.68 的均分」看起来完全正常。
 */
export const LECTURER_AVG_SCORE = (
  LECTURER_POOL.reduce((sum, card) => sum + Number(card.avgScore), 0) / LECTURER_POOL.length
).toFixed(2);

/**
 * R3 四张 KPI：池子人数 / 试讲合格 / 可上岗 / 综合评分。
 *
 * <p>四张都由池子算出。试讲合格（12）与可上岗（12a）现在人数碰巧相同，
 * 是因为合格者默认已可上岗；哪天有人合格但仍在培养中，这两张就会分开。
 */
export const LECTURER_KPIS = [
  { id: 'poolSize', label: '讲师池人数', value: thousands(LECTURER_POOL.length), delta: '↑ 12.5%', icon: 'Users' },
  { id: 'qualified', label: '试讲合格讲师数', value: thousands(LECTURER_QUALIFIED_COUNT), delta: '↑ 8.3%', icon: 'BadgeCheck' },
  { id: 'readyToTeach', label: '可上岗讲师数', value: thousands(LECTURER_READY_COUNT), delta: '↑ 10.0%', icon: 'UserCheck' },
  /* 4.47 /5：设计规范 3.3 的评分写法。环比 ↑ 0.21 是分差而不是百分比，
     所以这一张的 delta 不带 % —— 把它写成 21% 会读成评分涨了两成 */
  { id: 'avgScore', label: '讲师综合评分', value: LECTURER_AVG_SCORE, unit: '/ 5', delta: '↑ 0.21', icon: 'Star' },
] as const;

/**
 * R4 筛选器一行六个。取需求 10.7 P3-1 定的筛选条件。
 *
 * <p>全部未选中态：文档 0.3 禁止 fixture 随当前时间或交互变化。
 */
export const LECTURER_FILTERS = [
  { id: 'expertise', label: '擅长领域', value: '全部' },
  { id: 'sourceDept', label: '来源部门', value: '全部' },
  { id: 'trialQualified', label: '试讲合格标记', value: '全部' },
  { id: 'teachingCount', label: '授课次数', value: '全部' },
] as const;

/**
 * 按擅长领域分组，七组全部展开。
 *
 * <p>只按 {@code domains[0]} 归组：一个讲师挂两个领域时按第一个算，
 * 各组之和因此恒等于池子人数。<b>不要改成「出现在每个领域里」</b>——
 * 那样各组之和会大于池子人数，而池子头部那个「共 N 人」又是去重后的数，
 * 两个数不等就得在界面上额外解释一句。
 */
export const LECTURER_GROUPS: LecturerGroup[] = LECTURER_DOMAINS.map((domain) => {
  const cards = LECTURER_POOL.filter((card) => card.domains[0] === domain);
  return {
    id: `domain-${domain}`,
    domain,
    count: cards.length,
    expanded: true,
    cards,
  };
});

/** R5 头部的池子总人数。与 KPI「讲师池人数」同源同值 */
export const LECTURER_POOL_TOTAL = thousands(LECTURER_POOL.length);

/** 文档 8：默认选中李玥 */
export const LECTURER_SELECTED_ID = 'JS0431';

/**
 * 试讲结论的两个合法取值（转换表 5.6 第 52～53 行、需求 9.7.1 字段 7／8）。
 *
 * <p>界面要按「是不是合格」着色，因此需要一个可比较的常量。放在 fixtures 里
 * 而不是页面里：fixtures 扮演的是后端响应，状态值在这里是载荷（见 stateLiteralGuard 的说明）。
 * 页面里写死 `=== '合格'` 才是 STK-1 要防的那件事。
 */
export const TRIAL_CONCLUSION_QUALIFIED = '合格';
export const TRIAL_CONCLUSION_UNQUALIFIED = '不合格';

export interface TrialLedgerRow {
  id: string;
  course: string;
  /** 轮次号 = 该课程已有记录数 + 1（转换表 5.6 第 52 行） */
  round: string;
  lecturer: string;
  /** 讲师试讲结论（9.7.1 字段 7）：合格／不合格 */
  lecturerConclusion: string;
  /** 课程试讲结论（9.7.1 字段 8）：合格／不合格 */
  courseConclusion: string;
  /** 评审日期。纯日期语义，无时分秒 */
  reviewedAt: string;
}

/**
 * R6 试讲台账最近 5 条。
 *
 * <p>「结论一致」不单独存字段：它是两个结论的比较结果，界面上按两列算出来。
 * 存一个第三列会出现「两列写了不合格／合格、第三列写着一致」的自相矛盾数据 ——
 * 需求 5.6 的四格矩阵本来就只要求<b>标记</b>不一致，不要求持久化一个冗余布尔。
 *
 * <p>五条全部一致。双结论不一致的样例在 P09 评审记录中心，那页有专门的红色风险提示。
 */
export const TRIAL_LEDGER: TrialLedgerRow[] = withCurrentDates([
  {
    id: 'T-2405-09',
    course: '经销商赋能体系实战',
    round: '第 2 轮',
    lecturer: '周建',
    lecturerConclusion: '合格',
    courseConclusion: '合格',
    reviewedAt: '2024-05-09',
  },
  {
    id: 'T-2405-08b',
    course: '门店店效数据分析',
    round: '第 1 轮',
    lecturer: '陈晨',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    reviewedAt: '2024-05-08',
  },
  {
    id: 'T-2405-08a',
    course: '门店 AI 导购助手实战',
    round: '第 3 轮',
    lecturer: '李玥',
    lecturerConclusion: '合格',
    courseConclusion: '合格',
    reviewedAt: '2024-05-08',
  },
  {
    id: 'T-2405-07',
    course: '渠道政策解读与落地',
    round: '第 1 轮',
    lecturer: '黄悦',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    reviewedAt: '2024-05-07',
  },
  {
    id: 'T-2405-06',
    course: '政企标案写作进阶',
    round: '第 2 轮',
    lecturer: '吴迪',
    lecturerConclusion: '不合格',
    courseConclusion: '不合格',
    reviewedAt: '2024-05-06',
  },
]);

/**
 * R6 列宽（文档 8「内部几何」标注「必须照抄」）。
 *
 * 812px：课程 200｜轮次 90｜讲师 85｜讲师结论 105｜课程结论 105｜结论一致 90｜日期 90｜操作 47。
 * 合计 812，正好等于区域宽 —— 这是全文档少有的一组自洽的列宽，一个都不要动。
 */
export const TRIAL_LEDGER_COLUMNS = [
  { id: 'course', label: '课程名称', width: 200 },
  { id: 'round', label: '轮次', width: 90 },
  { id: 'lecturer', label: '讲师', width: 85 },
  { id: 'lecturerConclusion', label: '讲师结论', width: 105 },
  { id: 'courseConclusion', label: '课程结论', width: 105 },
  { id: 'consistent', label: '结论一致', width: 90 },
  { id: 'reviewedAt', label: '评审日期', width: 90 },
  { id: 'action', label: '操作', width: 47 },
] as const;

/** R7 详情四个页签。文档 8：默认停在「试讲记录」 */
export const LECTURER_DETAIL_TABS = ['基本信息', '试讲记录', '授课记录', '学员评价'] as const;
export const LECTURER_DETAIL_ACTIVE_TAB = 1;

/**
 * 详情头部的标签。设计稿给的是机器学习/深度学习/Python/数据挖掘/+2，
 * 换成消费电子业务条线下李玥真正在讲的方向。
 *
 * <p>「+2」是折叠计数而不是第五个标签，所以单独一个字段 —— 写成 `'+ 2'` 塞进数组的话，
 * 它会被当成一个叫「+ 2」的擅长领域参与筛选。
 */
export const LECTURER_DETAIL_DOMAINS = ['零售', 'MKT', '门店运营', '导购培训'] as const;
export const LECTURER_DETAIL_DOMAINS_MORE = 2;

/**
 * 岗位。不是账号角色 —— 一期没有角色表（禁区第 11 项）。
 *
 * <p>从人物名录取，与讲师卡上的来源部门同源：写死一份的话，
 * 改了名录里的部门，详情头部还挂着旧部门，同一个人在一屏里有两个部门。
 */
export const LECTURER_DETAIL_TITLE = (() => {
  const person = personByName('李玥');
  return person ? `${person.dept} · ${person.position}` : '';
})();

export interface TrialTimelineItem {
  round: string;
  /** 试讲结论：合格／不合格 */
  conclusion: string;
  /** 专家意见（9.7.1）。设计稿把它标成「结论」，实际结论只有两个值 */
  opinion: string;
  /** 参与人（TrialLedgerRow.participants）。一期没有「评审人」这个字段 */
  participants: string;
  date: string;
}

/**
 * R7 试讲时间线。文档 8：2024-05-08 通过、2024-04-22 条件通过、2024-04-10 未通过。
 *
 * <p>三个结论词全部换成合法值。第 2 轮的「条件通过」→「不合格」后，
 * 三轮变成「不合格 → 不合格 → 合格」，而这正是需求 5.4.3 允许的形状：
 * 试讲子状态在 待试讲 ↔ 试讲中 之间来回，直到某一轮课程结论为合格才进「待发布」。
 */
export const TRIAL_TIMELINE: TrialTimelineItem[] = withCurrentDates([
  {
    round: '第 3 轮',
    conclusion: '合格',
    opinion: '门店场景拆解到位，导购话术示范清晰，综合评分 4.8 / 5',
    participants: '张小北、周建、黄悦',
    date: '2024-05-08',
  },
  {
    round: '第 2 轮',
    conclusion: '不合格',
    opinion: '案例偏总部视角，建议补一线门店的实操演示',
    participants: '陈晨、李华',
    date: '2024-04-22',
  },
  {
    round: '第 1 轮',
    conclusion: '不合格',
    opinion: '节奏偏快，需优化结构与门店案例引入',
    participants: '赵敏、王宇',
    date: '2024-04-10',
  },
]);

export interface TeachingRecord {
  course: string;
  /** 培训场次。命名对照表：不用 class／batch */
  session: string;
  taughtOn: string;
  /** 本场平均评分（需求 10.5） */
  score: string;
}

/** R7「近期授课记录」三条。李玥的授课记录，评分与她的平均分 4.86 同一量级 */
export const TEACHING_RECORDS: TeachingRecord[] = withCurrentDates([
  { course: '门店 AI 导购助手实战', session: '第 12 期', taughtOn: '2024-05-10', score: '4.86' },
  { course: '零售终端陈列优化', session: '第 9 期', taughtOn: '2024-04-28', score: '4.78' },
  { course: '门店店效数据分析', session: '第 15 期', taughtOn: '2024-04-12', score: '4.81' },
]);

/**
 * R7 底部的「讲师成长建议」。<b>仅回归模式渲染，产品模式整块隐藏。</b>
 *
 * <p>需求 N6 与 10.1：讲师层级、能力标签、熟练度、培养建议一期不做，随二期上线补齐。
 * 设计稿返修清单 §13 也已把它标为二期。
 *
 * <p>裁决口径与 V-8（P06 的组织覆盖区）一致：<b>按设计稿建区域、数据只用 fixture、
 * 产品模式不渲染</b>。留着回归模式是为了 R7 的 753px 版式能对上像素；
 * 产品模式渲染出来就成了「平台会给培养建议」的承诺，而它背后没有任何模型。
 */
export const GROWTH_ADVICE = {
  title: '讲师成长建议',
  body: '继续保持高质量授课表现，建议尝试开发进阶实战类课程，扩大影响力。',
  action: '查看建议详情',
} as const;

export interface LecturerDetailField {
  label: string;
  value: string;
}

export interface StudentEvaluation {
  student: string;
  session: string;
  score: string;
  comment: string;
}

/** 岗位行。从人物名录取，与讲师卡上的来源部门同源 */
export function lecturerTitleOf(name: string): string {
  const person = personByName(name);
  return person ? `${person.dept} · ${person.position}` : '';
}

/**
 * 产品模式详情「基本信息」的只读档案。字段与新建表单同一套。
 *
 * <p>60 张卡本身不扩列——等级、上岗、简介由卡上已有指标与名录推导，避免改
 * {@link LECTURER_POOL} 把 p04 像素基线一起打掉。回归模式不走这份档案。
 *
 * <p>上岗状态与培养状态对齐后端 {@code dutyStateOf}：可上岗↔可上岗，
 * 培养中↔暂停授课，待培养↔已下线。等级按授课次数分档，只是展示，不是评估模型。
 */
export function lecturerArchiveOf(card: LecturerCard) {
  const person = personByName(card.name);
  return {
    name: card.name,
    lecturerNo: card.id,
    employeeNo: person?.no ?? null,
    sourceDept: card.dept,
    lecturerLevel: lecturerLevelOf(card.teachingCount),
    dutyState: dutyStateOf(card),
    expertiseDomains: card.domains,
    capabilityTags: person?.position ?? null,
    bio: person
      ? `${person.position}。擅长${card.domains.join('、')}。`
      : `擅长${card.domains.join('、')}。`,
    portraitSrc: avatarUrlOf(card.name) ?? null,
    availableTime: null,
    scheduleLimit: null,
    joinedDate: null,
    profileMaintainer: null,
    poolState: '在池',
    removedReason: null,
    remark: null,
    trialQualified: card.trialQualified,
    teachingCount: card.teachingCount,
    avgScore: card.avgScore,
    attendees: card.attendees,
  };
}

function dutyStateOf(card: LecturerCard): string {
  if (card.cultivationStatus === '培养中') return '暂停授课';
  if (card.cultivationStatus === '待培养') return '已下线';
  return '可上岗';
}

function lecturerLevelOf(teachingCount: number): string {
  if (teachingCount >= 18) return 'L3';
  if (teachingCount >= 12) return 'L2';
  if (teachingCount >= 6) return 'L1';
  return 'L0';
}

function fieldValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

/**
 * 详情「基本信息」字段。取值全部来自 {@link lecturerArchiveOf}，不另写一份。
 *
 * <p>产品模式点开任意讲师都走这里；回归模式详情头部仍用冻结的
 * {@link LECTURER_DETAIL_TITLE} 与 {@link LECTURER_DETAIL_DOMAINS}，
 * 以免改一份数据把 p04 像素基线一起打掉。
 */
export function lecturerBasicFieldsOf(card: LecturerCard): LecturerDetailField[] {
  const archive = lecturerArchiveOf(card);
  return [
    { label: '讲师ID', value: archive.lecturerNo },
    { label: '讲师姓名', value: archive.name },
    { label: '工号', value: fieldValue(archive.employeeNo) },
    { label: '来源部门', value: fieldValue(archive.sourceDept) },
    { label: '讲师等级', value: fieldValue(archive.lecturerLevel) },
    { label: '上岗状态', value: fieldValue(archive.dutyState) },
    { label: '擅长领域', value: archive.expertiseDomains.join('、') || '—' },
    { label: '能力标签', value: fieldValue(archive.capabilityTags) },
    { label: '讲师简介', value: fieldValue(archive.bio) },
    { label: '可授课时间', value: fieldValue(archive.availableTime) },
    { label: '排课限制说明', value: fieldValue(archive.scheduleLimit) },
    { label: '建档时间', value: fieldValue(archive.joinedDate) },
    { label: '档案维护人', value: fieldValue(archive.profileMaintainer) },
    { label: '在池状态', value: fieldValue(archive.poolState) },
    { label: '备注信息', value: fieldValue(archive.remark) },
    { label: '试讲合格', value: archive.trialQualified ? '是' : '否' },
    { label: '授课次数', value: String(archive.teachingCount) },
    { label: '学员评分', value: `${archive.avgScore} / 5` },
    { label: '学员人次', value: archive.attendees.toLocaleString('en-US') },
  ];
}

/**
 * 该讲师的试讲时间线。李玥走冻结的三轮（p04 钉死了日期与参与人），
 * 其余人按合格标记给一轮结论 —— 不是新编的状态机，只是让右侧详情不再所有人都是李玥的课。
 */
export function lecturerTimelineOf(card: LecturerCard): TrialTimelineItem[] {
  if (card.id === LECTURER_SELECTED_ID) return TRIAL_TIMELINE;
  const qualified = card.trialQualified;
  return withCurrentDates([
    {
      round: qualified ? '第 2 轮' : '第 1 轮',
      conclusion: qualified ? TRIAL_CONCLUSION_QUALIFIED : TRIAL_CONCLUSION_UNQUALIFIED,
      opinion: qualified
        ? `${card.domains[0] ?? ''}场景拆解清楚，综合评分 ${card.avgScore} / 5`
        : '案例偏总部视角，建议补一线实操演示后再试讲',
      participants: '张小北、周建',
      date: qualified ? '2024-05-08' : '2024-04-22',
    },
  ]);
}

/**
 * 该讲师的近期授课。李玥走冻结三条；授课次数为 0 的人给空数组。
 */
export function lecturerTeachingOf(card: LecturerCard): TeachingRecord[] {
  if (card.id === LECTURER_SELECTED_ID) return TEACHING_RECORDS;
  if (card.teachingCount <= 0) return [];
  const domain = card.domains[0] ?? '零售';
  return withCurrentDates([
    {
      course: `${domain}一线实战`,
      session: `第 ${Math.max(1, card.teachingCount)} 期`,
      taughtOn: '2024-05-10',
      score: card.avgScore,
    },
  ]);
}

export function lecturerEvaluationsOf(card: LecturerCard): StudentEvaluation[] {
  if (card.teachingCount <= 0) return [];
  return [
    {
      student: '门店学员甲',
      session: `第 ${Math.max(1, card.teachingCount)} 期`,
      score: card.avgScore,
      comment: `「${card.domains[0] ?? ''}」部分能直接带回门店用。`,
    },
  ];
}
