import { useMemo } from 'react';
import { Alert, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { demandApi, type Demand } from '@/shared/api/demands';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { BarChart, FunnelChart } from '@/shared/ui/MiniChart';
import { DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS, DICT_KEYS, useDicts, useMachines } from './demandMeta';

/**
 * 需求态势图（需求 8.2 的 P1-3）：按领域与状态的分布图（柱状 + 漏斗）。
 *
 * <p>它原本是一个独立页面，现在是需求驾驶舱底部分析区的三块。挪位置的理由见
 * {@code AnalyticsRow} 的注释：看图与看列表是同一个判断动作的两半。
 *
 * <p><b>三张图都用后端已有的列表接口在前端聚合</b>，没有为它新建统计接口：指标与预聚合属
 * 阶段 3，而且需求量级在数百，一次取全量比维护一个只服务于一张图的接口划算（需求 U2、C14：
 * 实时计算，不建预聚合）。取数按分页上限逐页拉，取到全部为止——只取第一页会让这三张图变成
 * 「前 200 条的分布」，而图上看不出来。
 *
 * <p><b>漏斗画的是当前存量，不是转化率。</b>各阶段按流程顺序排列、宽度按数量，但一条需求
 * 在图上只出现在它当前所处的那一档。把它当成「100 条进来、80 条走到下一步」来读会得出错误
 * 结论，因此图上写明了这一点——真正的转化要看状态流转日志，那属于阶段 3 的指标。
 *
 * <p>两种图形本身在 {@code shared/ui/MiniChart}，讲师池分布用的是同一份。
 */

/** 单页上限（API-6）。逐页取直到取完，最多 10 页——再多说明数据量级已经超出「实时聚合」的假设。 */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

interface Loaded {
  rows: Demand[];
  /** 是否因为页数上限而没取完。取不完时必须说出来，否则图会安静地少算一截 */
  truncated: boolean;
  total: number;
}

async function loadAll(): Promise<Loaded> {
  const rows: Demand[] = [];
  let total = 0;
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
    const page = await demandApi.page({}, pageNum, PAGE_SIZE);
    total = page.total;
    rows.push(...page.records);
    if (rows.length >= page.total || page.records.length === 0) {
      return { rows, truncated: false, total };
    }
  }
  return { rows, truncated: rows.length < total, total };
}

export function DemandDistribution() {
  const dicts = useDicts();
  const machines = useMachines();

  const loaded = useQuery({
    queryKey: ['demands', 'overview'],
    queryFn: loadAll,
  });

  const rows = useMemo(() => loaded.data?.rows ?? [], [loaded.data]);
  const combatUnits = dicts.data?.[DICT_KEYS.combatUnit];

  const byDomain = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.domainCode, (counts.get(row.domainCode) ?? 0) + 1));
    return [...counts.entries()]
      .map(([code, count]) => ({
        // 字典给的是编码，图上要显示名称；字典里没有的编码原样显示，不吞掉
        label: (combatUnits ?? []).find((item) => item.code === code)?.name ?? code,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows, combatUnits]);

  /** 评审状态按转换表的出现顺序排列，即业务流程顺序——不在前端另排一遍 */
  const reviewStates =
    machines.data?.find(
      (m) => m.objectType === DEMAND_OBJECT_TYPE_CODE && m.stateField === DEMAND_STATE_FIELDS.review,
    )?.states ?? [];

  const byReviewState = useMemo(
    () =>
      reviewStates.map((state) => ({
        label: state,
        count: rows.filter((row) => row.reviewState === state).length,
      })),
    [reviewStates, rows],
  );

  /**
   * 当前处理状态：出口一取解决方案状态、出口二取需求开发状态，这一列由后端算好
   * （需求 8.6）。前端按出口分支就得知道哪个出口对哪组状态，那是后端已经做过的判断。
   */
  const byProcessState = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      if (row.currentProcessState) {
        counts.set(row.currentProcessState, (counts.get(row.currentProcessState) ?? 0) + 1);
      }
    });
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
  }, [rows]);

  return (
    <>
      {loaded.data?.truncated && (
        <Alert
          type="warning"
          showIcon
          style={{ gridColumn: '1 / -1' }}
          message="数据没有取完"
          description={`共 ${loaded.data.total} 条需求，本页只统计了前 ${rows.length} 条。这三张图按实时全量聚合设计，出现这条提示说明数据量已超出前端聚合的适用范围，请反馈以便改为后端统计。`}
        />
      )}

      <AnalyticsCard title="按所属领域分布" note={`共 ${rows.length} 条需求`}>
        <Spin spinning={loaded.isLoading}>
          <BarChart items={byDomain} emptyText="还没有需求数据" />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard
        title="按评审状态分布"
        note="按流程顺序排列。图上是当前存量，不是转化率——一条需求只出现在它此刻所处的那一档"
      >
        <Spin spinning={loaded.isLoading}>
          <FunnelChart items={byReviewState} emptyText="还没有需求数据" />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard title="按当前处理状态分布">
        <Spin spinning={loaded.isLoading}>
          <BarChart
            items={byProcessState}
            emptyText="还没有需求进入分流后的处理阶段。分流出口在右侧详情面板的「评审信息」页签随评审结论一起录入"
          />
        </Spin>
      </AnalyticsCard>
    </>
  );
}
