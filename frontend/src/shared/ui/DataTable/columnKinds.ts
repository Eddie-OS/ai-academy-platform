/**
 * 列类型 → 基准宽度与对齐（设计规范 5.3、5.4）。
 *
 * <p>不使用等分列宽：名称列吸收剩余空间，其余列按内容类型给定宽度。把这张表放在组件里
 * 而不是让每个页面自己写 {@code width: 112}，是因为 13 个列表页出现同一种列时宽度必须一致——
 * 「编号」在一个页面 112px、在另一个页面 120px，纵向扫描的节奏就断了。
 */

export type ColumnKind =
  | 'code'
  | 'name'
  | 'statusMain'
  | 'statusSub'
  | 'light'
  | 'person'
  | 'personAvatar'
  | 'combatUnit'
  | 'dept'
  | 'date'
  | 'datetime'
  | 'number'
  | 'percent'
  | 'validity'
  | 'training'
  | 'tags'
  | 'actions';

interface KindSpec {
  /** 基准宽度。名称列为 undefined，表示吸收剩余宽度（最小宽度另给） */
  width?: number;
  minWidth?: number;
  align: 'left' | 'right';
  /** 数字列须用 tabular-nums，否则不同行的数字位宽不一，右对齐也对不齐 */
  tabularNums?: boolean;
}

export const COLUMN_KINDS: Record<ColumnKind, KindSpec> = {
  code: { width: 112, align: 'left' },
  name: { minWidth: 200, align: 'left' },
  statusMain: { width: 132, align: 'left' },
  statusSub: { width: 120, align: 'left' },
  light: { width: 140, align: 'left' },
  person: { width: 96, align: 'left' },
  personAvatar: { width: 132, align: 'left' },
  combatUnit: { width: 112, align: 'left' },
  // 自由文本（需求 N18 删除部门实体后），超出省略号 + Tooltip
  dept: { width: 140, align: 'left' },
  date: { width: 112, align: 'left' },
  datetime: { width: 148, align: 'left' },
  number: { width: 88, align: 'right', tabularNums: true },
  percent: { width: 96, align: 'right', tabularNums: true },
  validity: { width: 128, align: 'left' },
  training: { width: 96, align: 'left' },
  tags: { width: 180, align: 'left' },
  actions: { align: 'right' },
};

/** 操作列宽度按钮数决定（5.4：按钮数 × 56 + 32）。 */
export function actionsWidth(buttonCount: number): number {
  return buttonCount * 56 + 32;
}

/** 建议可见列数上限（5.4）：1440px 下内容区 1152px，超过 9 列就该靠列设置默认隐藏。 */
export const MAX_VISIBLE_COLUMNS = 9;
