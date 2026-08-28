import {
  Activity,
  Award,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Eye,
  FileText,
  FolderCheck,
  Inbox,
  Lightbulb,
  Megaphone,
  MessageSquare,
  PlayCircle,
  Presentation,
  Rocket,
  ThumbsUp,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import type { MetricCardSpec } from '@/shared/ui/CockpitLayout';

/**
 * 五个驾驶舱顶部指标卡的清单。
 *
 * <p><b>阶段 2 只有名字与位置，没有数字。</b>口径、三色灯阈值与环比区间全部属于阶段 3 的
 * {@code aggregate/metrics}（需求 15.1～15.4）。这里集中一处而不是散在五个驾驶舱页里，
 * 是为了让阶段 3 接真实数值时只改一个文件——五处各改一遍必然漏掉一处，而漏掉的那处
 * 会一直显示「阶段 3 接入」，没人会注意到。
 *
 * <p><b>为什么这个文件在 STK-1 白名单里。</b>需求 15.1／15.2 定的指标名里有几个含状态词
 * （「课程已发布数」「开发中需求数」），而状态硬编码门禁是按子串匹配的。这些字符串是
 * 指标的中文名，只往卡片标题上渲染，不参与任何状态判断、不做比较、不当查表的键——
 * 把它们关在这一个文件里，五个驾驶舱页就仍然受门禁保护。
 */

/** 驾驶舱一 · AI需求（需求 7.4 ①、15.1）。 */
export const DEMAND_METRICS: MetricCardSpec[] = [
  { key: 'total', title: '需求总数', icon: <Inbox size={18} />, source: '需求 15.1' },
  { key: 'pending', title: '待评审需求数', icon: <FileText size={18} />, source: '需求 15.1' },
  { key: 'developing', title: '开发中需求数', icon: <Rocket size={18} />, source: '需求 15.1' },
  { key: 'cycle', title: '需求平均评审周期', icon: <Lightbulb size={18} />, source: '需求 15.2 · E1' },
];

/**
 * 驾驶舱二 · 课程工作台。
 *
 * <p>五张卡按工作台改版：累计值 + 月度环比。环比接口尚未下发时 delta 为「—」。
 * 「评审中」是卡名，计数取主状态「评审决策」（状态机里没有「评审中」这个值）。
 * 「待试讲」计数取主状态「试讲」——进入该状态时系统即置试讲子状态「待试讲」，入状态那一刻两者同值。
 *
 * <p><b>卡名与口径都要与 V2 复刻件（`fixtures/course.ts` 的 `COURSE_KPIS`）逐字一致。</b>
 * 两页一边叫「开发」一边叫「开发中」时，同一个数在两个页面上像是两个指标；
 * 口径写进 `hint`，鼠标停在问号上就能看见这张卡数的到底是哪个状态。
 */
export const COURSE_METRICS: MetricCardSpec[] = [
  { key: 'total', title: '课程总数', icon: <BookOpen size={18} />, source: '未删除课程（含终态）', hint: '七列存量 + 三个终态' },
  { key: 'developing', title: '开发中', icon: <Rocket size={18} />, source: '主状态=开发', hint: '主状态=开发' },
  { key: 'reviewing', title: '评审中', icon: <FileText size={18} />, source: '主状态=评审决策', hint: '主状态=评审决策' },
  { key: 'pendingTrial', title: '待试讲', icon: <Presentation size={18} />, source: '主状态=试讲', hint: '主状态=试讲' },
  { key: 'published', title: '已发布', icon: <Award size={18} />, source: '主状态=发布', hint: '主状态=发布' },
];

/**
 * 驾驶舱三 · 讲师与能力地图（需求 7.4 ③、15.1 第 12a 项、15.3 第 7 项）。
 *
 * <p>没有「能力地图」相关的卡：讲师能力地图一期不做（N6）。「可上岗讲师数」是 V1.2 用来
 * 替代原「试讲合格讲师数」的指标，口径以培养状态为准而不是以试讲标记为准。
 */
export const LECTURER_METRICS: MetricCardSpec[] = [
  { key: 'pool', title: '讲师池人数', icon: <Users size={18} />, source: '需求 7.4 ③' },
  { key: 'qualified', title: '可上岗讲师数', icon: <UserCheck size={18} />, source: '需求 15.1 · 12a' },
  { key: 'attendees', title: '本月授课人次', icon: <Presentation size={18} />, source: '需求 15.3 · 5' },
  { key: 'active', title: '活跃讲师数', icon: <Activity size={18} />, source: '需求 15.3 · 7' },
];

/**
 * 驾驶舱五 · 案例（需求 7.4 ⑤、15.1／15.5；V2.0 P06 产品模式五卡）。
 *
 * <p>覆盖类第六卡「已覆盖部门数」在 V2 复刻件整页展示（V-65），业务驾驶舱指标清单仍不收录——
 * 一期没有组织架构分母，legacy 驾驶舱顶部卡继续只出可落地的五张。
 * 「浏览次数」不是「阅读量」——15.5 硬改名。
 */
export const CASE_METRICS: MetricCardSpec[] = [
  { key: 'total', title: '案例总数', icon: <Trophy size={18} />, source: '需求 15.1 · 17' },
  { key: 'published', title: '已上架案例数', icon: <Megaphone size={18} />, source: '需求 15.1 · 18' },
  { key: 'views', title: '浏览次数', icon: <Eye size={18} />, source: '需求 15.5 · 1' },
  { key: 'likes', title: '点赞量', icon: <ThumbsUp size={18} />, source: '需求 15.5 · 2' },
  { key: 'comments', title: '评论数', icon: <MessageSquare size={18} />, source: '需求 15.5 · 3' },
];

/**
 * 驾驶舱四 · 培训运营地图（需求 7.4 ④、15.1 第 13～16 项、13.1.2 任务派生）。
 *
 * <p>六名与 V2.0 P05／业务裁决 V-38 对齐。「本周培训计划数」在 7.4 有出处、15.1 无公式；
 * 「待导入签到」「待归档」是任务派生计数，不是数量类指标。
 */
export const TRAINING_METRICS: MetricCardSpec[] = [
  { key: 'plans', title: '本月培训计划数', icon: <CalendarDays size={18} />, source: '需求 15.1 · 13' },
  { key: 'weekPlans', title: '本周培训计划数', icon: <CalendarCheck size={18} />, source: '需求 7.4 ④' },
  { key: 'sessions', title: '进行中培训场次', icon: <PlayCircle size={18} />, source: '需求 15.1 · 14' },
  { key: 'attendees', title: '本月参训人次', icon: <Users size={18} />, source: '需求 15.1 · 16' },
  { key: 'attendance', title: '待导入签到', icon: <UserCheck size={18} />, source: '需求 13.1.2' },
  { key: 'archive', title: '待归档', icon: <FolderCheck size={18} />, source: '需求 13.1.2' },
];

/** 千分位整数；null／undefined 渲染为「—」（设计规范 3.3）。 */
export function formatMetricInt(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('zh-CN').format(value);
}

/** 把数量类接口返回值填进指标卡；未返回的 key 保持 pending 形态。 */
export const METRIC_DELTA_LABEL = '月度环比（较上月）';

/**
 * 环比文案。百分比保留 1 位小数、整数也保留（设计规范 3.3）。
 *
 * <p>箭头必须跟着符号出：光靠颜色区分涨跌，在灰度打印与红绿色盲视野下就没有区别了
 * （WV1 同理 —— 色不做唯一载体）。所以 `↑ 8.3%` / `↓ 4.2%` 里的箭头是信息，不是装饰。
 */
export function formatMetricDelta(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return '—';
  return `${percent < 0 ? '↓' : '↑'} ${Math.abs(percent).toFixed(1)}%`;
}

export function mergeMetricValues(
  specs: MetricCardSpec[],
  data?: Record<string, number> | null,
): MetricCardSpec[] {
  if (!data) return specs;
  return specs.map((spec) => {
    const raw = data[spec.key];
    if (raw === undefined) return spec;
    return {
      ...spec,
      value: formatMetricInt(raw),
      delta: spec.delta ?? '—',
      deltaLabel: spec.deltaLabel ?? METRIC_DELTA_LABEL,
    };
  });
}

/** 周期均值保留 1 位小数（设计规范 3.3）。后端把均值当金额比率类走字符串下发。 */
export function formatCycle(value: string | number): string {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '—';
}

/**
 * 把效率摘要里的周期均值填进指标卡。
 *
 * <p>三种入参要分开处理：`undefined` 是「还没取到」，卡片保持 pending 形态；
 * `null` 是「取到了但算不出均值」（区间内没有样本），必须落成「—」——
 * 沿用 pending 会让人一直等一个永远不会来的数字。
 */
export function mergeCycleMetric(
  specs: MetricCardSpec[],
  cycle: string | number | null | undefined,
  key = 'cycle',
): MetricCardSpec[] {
  if (cycle === undefined) return specs;
  return specs.map((spec) => {
    if (spec.key !== key) return spec;
    if (cycle === null) return { ...spec, value: '—', suffix: undefined };
    return { ...spec, value: formatCycle(cycle), suffix: '天' };
  });
}
