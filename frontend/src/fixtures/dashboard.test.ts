import { describe, expect, it } from 'vitest';
import { DASHBOARD_ENTRIES, DASHBOARD_KPIS, ENTRY_STAT_LABELS } from './dashboard';

describe('R3 KPI 与 R4 入口卡', () => {
  /*
   * 两行的卡片数必须相等。
   *
   * 这不是审美要求：两行用的是同一个 --grid-gap，列数相同时竖直分界线才逐列对齐，
   * 而「五张 KPI 与五个驾驶舱对齐」正是 V-70 撤掉「课程总数」那张卡要达到的效果。
   * 往 DASHBOARD_KPIS 里补第六个指标不会报错，只会让上下两行整体错开 ——
   * 错开量是 1320/5 与 1320/6 之差的累积，第一列几乎看不出来，到最后一列差 44px。
   */
  it('KPI 张数与入口卡张数相等，两行才逐列对齐', () => {
    expect(DASHBOARD_KPIS).toHaveLength(DASHBOARD_ENTRIES.length);
  });
});

describe('R4 五张业务入口卡', () => {
  /*
   * 回归模式的冻结数与产品模式的标签必须一样多。
   *
   * 两边条数不等时页面照样渲染：产品模式按标签铺格子，请求回来前按冻结数铺，
   * 于是接口一到，某张卡的底部数从两格变三格、整卡版式跳一下。
   * 这一跳只在真实环境的首屏出现，回归模式（不发请求）永远看不到。
   */
  it('冻结数的条数与产品模式标签条数一致', () => {
    for (const entry of DASHBOARD_ENTRIES) {
      expect(entry.stats, `${entry.title} 的冻结数条数`).toHaveLength(
        ENTRY_STAT_LABELS[entry.cockpit].length,
      );
    }
  });

  /*
   * 每张卡的底部数是 2 条或 3 条。
   *
   * 上限 3 是版式约束：入口卡宽 1320/5 − gap ≈ 253px，减去 16×2 内边距后
   * 每格 73px，放得下「浏览次数 12,480」这种最长的一对；给到 4 条时每格 53px，
   * 五个字的标签必然截断成「浏览次…」。
   */
  it('底部数是两条或三条', () => {
    for (const [section, labels] of Object.entries(ENTRY_STAT_LABELS)) {
      expect(labels.length, `${section} 的标签条数`).toBeGreaterThanOrEqual(2);
      expect(labels.length, `${section} 的标签条数`).toBeLessThanOrEqual(3);
    }
  });
});
