import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  CalendarX,
  Check,
  Circle,
  CircleCheckBig,
  CircleDot,
  Clock,
  Hourglass,
  Infinity as InfinityIcon,
  Pencil,
} from 'lucide-react';
import { brand, fontSize, lineHeight, neutral, radius, semantic, space } from '@/shared/theme/designTokens';

/**
 * 三组状态标签（设计规范 2.10，规则 SV1–SV5）。
 *
 * <p>与三色灯刻意分开：三色灯是<b>预警</b>，这三组是<b>状态</b>。SV2 要求两者在列表里
 * 分列不同列、不得合并；SV5 明确案例「待审核」不亮灯。合并成一个组件会让这条边界消失。
 *
 * <p>配色不接受调用方覆盖。规范给的每一组底色／文字色都是按 4.5:1 实测过的组合
 * （2.10 的对比度列），开放 props 等于把这三张表变成建议。
 */

interface TagStyle {
  bg: string;
  color: string;
  icon: LucideIcon;
}

/** 「不显示标签」用 null 表达（SV1：正常态不占视觉）。 */
type TagSpec = TagStyle | null;

const NEUTRAL_TAG = { bg: neutral[100], color: neutral[600] };

/**
 * 课程有效期状态（需求 9.3.1a）。
 *
 * 「有效」与「未发布」为 null：200 门课里 180 门都挂一个绿标签，列表会变成色块墙，
 * 真正需要注意的 20 门反而看不见（SV1）。
 */
const COURSE_VALIDITY: Record<string, TagSpec> = {
  长期有效: { ...NEUTRAL_TAG, icon: InfinityIcon },
  有效: null,
  '30 天内到期': { bg: semantic.warning.bg, color: semantic.warning.textOnBg, icon: Clock },
  已过期: { bg: semantic.danger.bg, color: semantic.danger.textOnBg, icon: CalendarX },
  未发布: null,
};

/**
 * 讲师培养状态（需求 10.3.1）。
 *
 * SV3：严禁用绿色表示「可上岗」——培养状态可被运营自由改回（TS1），
 * 而绿色在本平台是「成功／通过」。三个圆形图标的填充程度递增来表达进度。
 */
const LECTURER_TRAINING: Record<string, TagSpec> = {
  待培养: { ...NEUTRAL_TAG, icon: Circle },
  培养中: { bg: brand[50], color: brand[700], icon: CircleDot },
  可上岗: { bg: brand[100], color: brand[700], icon: CircleCheckBig },
};

/**
 * 案例状态（需求 5.9）。
 *
 * SV4：「待审核」用蓝色系不用黄色系——黄色的语义是「已逾期」（使用者做错了事），
 * 待审核是正常流程中的等待环节。两者共用黄色会让运营对黄色整体脱敏。
 */
const CASE_STATUS: Record<string, TagSpec> = {
  整理中: { ...NEUTRAL_TAG, icon: Pencil },
  待审核: { bg: semantic.info.bg, color: semantic.info.textOnBg, icon: Hourglass },
  已上架: { bg: semantic.success.bg, color: semantic.success.textOnBg, icon: Check },
  // 底色比「整理中」深一档，视觉上「沉下去」；文字用 neutral-700 而非 500，
  // 因为下架案例仍需被检索与阅读，不属于 WCAG 的失效控件豁免
  已下架: { bg: neutral[200], color: neutral[700], icon: Archive },
};

export const STATUS_TAG_GROUPS = {
  courseValidity: COURSE_VALIDITY,
  lecturerTraining: LECTURER_TRAINING,
  caseStatus: CASE_STATUS,
} as const;

export type StatusTagGroup = keyof typeof STATUS_TAG_GROUPS;

interface StatusTagProps {
  group: StatusTagGroup;
  /**
   * 状态值，取后端下发的中文枚举名（/api/meta/enums 或对象字段原值）。
   *
   * 认不出的取值一律不渲染，不猜、不兜底成灰标签：出现未知取值意味着前后端枚举
   * 已经不一致，静默显示一个灰标签会把这个问题藏起来。
   */
  value: string | null | undefined;
}

export function StatusTag({ group, value }: StatusTagProps) {
  const spec = value ? STATUS_TAG_GROUPS[group][value] : null;
  if (!spec) {
    return null;
  }

  const Icon = spec.icon;
  return (
    <span
      data-testid="status-tag"
      data-group={group}
      data-value={value}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space['2xs'],
        height: 22,
        padding: `${space['3xs']}px ${space.xs}px`,
        borderRadius: radius.xs,
        background: spec.bg,
        color: spec.color,
        fontSize: fontSize.bodySm,
        lineHeight: lineHeight.bodySm,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} color={spec.color} />
      {value}
    </span>
  );
}
