import { describe, expect, it } from 'vitest';
import { DASHBOARD_ENTRIES, DASHBOARD_KPIS } from './dashboard';

describe('R4 五张业务入口卡', () => {
  /*
   * 五张卡并排，每张的三个数在同一条基线上。
   *
   * 这条断言防的是一个具体的回退：案例卡的「覆盖组织」「覆盖率」属于 N18 已删除的
   * 组织覆盖口径（V-8），产品模式不能渲染。最初的做法是逐条过滤，于是产品模式下
   * 案例卡只剩一个数，和另外四张三数卡并排时版式明显是坏的 ——
   * 而它「坏」的方式恰好长得像「另两个接口没通」，会引着人去补一个按部门统计的接口。
   *
   * 正确做法是整组换成 productStats。两种模式都必须是三个数。
   */
  it('两种模式下都是三个数', () => {
    for (const entry of DASHBOARD_ENTRIES) {
      expect(entry.stats, `${entry.title} 的回归模式三数`).toHaveLength(3);
      if (entry.productStats) {
        expect(entry.productStats, `${entry.title} 的产品模式三数`).toHaveLength(3);
      }
    }
  });

  /*
   * 徽章取该驾驶舱对应的那张 KPI。同一个数在一页里出现两次，对不上会直接被当成 bug，
   * 而两处离得远（R3 在页顶、R4 在其下），并排看不到。
   */
  it('徽章与 R3 的 KPI 同源', () => {
    const kpiValues = new Set(DASHBOARD_KPIS.map((kpi) => kpi.value));
    for (const entry of DASHBOARD_ENTRIES) {
      expect(kpiValues, `${entry.title} 的徽章 ${entry.badge} 不在六张 KPI 的取值里`).toContain(
        entry.badge,
      );
    }
  });

  /*
   * 三数里不重复徽章那个数。案例卡的 V2.0 原文第一条正是「案例总数 186」，
   * 与徽章的 186 同值 —— 徽章那个 186 是 KPI「案例上架数」，两处叫法还不一样。
   * 回归模式必须照抄文档，所以只约束产品模式。
   */
  it('产品模式的三数不重复徽章', () => {
    for (const entry of DASHBOARD_ENTRIES) {
      const stats = entry.productStats ?? entry.stats;
      const repeated = stats.filter((stat) => stat.value === entry.badge);
      expect(repeated, `${entry.title} 的三数里重复了徽章 ${entry.badge}`).toEqual([]);
    }
  });
});
