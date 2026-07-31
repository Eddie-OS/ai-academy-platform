import { fontSize } from '@/shared/theme/designTokens';

/**
 * 三档密度（设计规范 5.2）。偏好按「当前用户 + 当前页面」记住，存本地不入库。
 *
 * <p>存本地是规范的明确要求，实现上要注意两件事：键必须带页面标识（同一个人在列表页
 * 想紧凑、在详情页的子表想宽松是常见的），以及 localStorage 不可用时不能抛异常——
 * 浏览器隐私模式下读写会直接 throw，一个密度偏好不值得让整个列表页白屏。
 */

export type Density = 'compact' | 'default' | 'comfortable';

export const DENSITIES: Record<Density, { label: string; rowHeight: number; cellPaddingY: number; fontSize: number }> = {
  compact: { label: '紧凑', rowHeight: 40, cellPaddingY: 9, fontSize: fontSize.bodySm },
  default: { label: '默认', rowHeight: 48, cellPaddingY: 13, fontSize: fontSize.body },
  comfortable: { label: '宽松', rowHeight: 56, cellPaddingY: 17, fontSize: fontSize.body },
};

export const DEFAULT_DENSITY: Density = 'default';

const PREFIX = 'aiap.density.';

export function readDensity(storageKey: string): Density {
  try {
    const stored = window.localStorage.getItem(PREFIX + storageKey);
    return stored && stored in DENSITIES ? (stored as Density) : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function writeDensity(storageKey: string, density: Density): void {
  try {
    window.localStorage.setItem(PREFIX + storageKey, density);
  } catch {
    // 隐私模式下写入失败：本次会话内密度仍然生效，只是下次进来回到默认值
  }
}
