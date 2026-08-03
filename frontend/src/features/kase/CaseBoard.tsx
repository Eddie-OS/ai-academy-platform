import { useMemo } from 'react';
import { Alert, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { caseApi, type CaseInfo } from '@/shared/api/cases';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { BarChart, FunnelChart } from '@/shared/ui/MiniChart';
import { CASE_OBJECT_TYPE, CASE_STATE_FIELD, useDomainNames, useStates } from './caseMeta';

/**
 * 案例数据看板（需求 12.7 原 P5-1），案例驾驶舱底部分析区。
 *
 * <p><b>没有「组织覆盖情况」。</b>原 P5-1 有一块按部门看覆盖率的视图，随 N18 删除组织架构后
 * 一并取消（N12）——一期不导入组织架构，覆盖率没有分母。画一张分母是猜的图，比不画更糟。
 *
 * <p><b>没有热力图、没有地图。</b>唯一的热力图场景已推二期（不做清单第 14 项）。
 *
 * <p>与需求态势图一样在前端聚合、不新建统计接口：案例量级在百，实时全量聚合比维护一个只服务
 * 于三张图的接口划算（规则 U2、C14）。
 */

/** 单页上限（API-6）。逐页取直到取完。 */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

interface Loaded {
  rows: CaseInfo[];
  truncated: boolean;
  total: number;
}

async function loadAll(): Promise<Loaded> {
  const rows: CaseInfo[] = [];
  let total = 0;
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
    const page = await caseApi.page({}, pageNum, PAGE_SIZE);
    total = page.total;
    rows.push(...page.records);
    if (rows.length >= page.total || page.records.length === 0) {
      return { rows, truncated: false, total };
    }
  }
  return { rows, truncated: rows.length < total, total };
}

export function CaseBoard() {
  const domainName = useDomainNames();
  /** 档位顺序取转换表的出现顺序（即流程顺序），不在前端另排一遍 */
  const states = useStates(CASE_OBJECT_TYPE, CASE_STATE_FIELD);

  const loaded = useQuery({ queryKey: ['cases', 'overview'], queryFn: loadAll });
  const rows = useMemo(() => loaded.data?.rows ?? [], [loaded.data]);

  const byState = useMemo(
    () => states.map((state) => ({ label: state, count: rows.filter((r) => r.caseState === state).length })),
    [states, rows],
  );

  const byDomain = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) =>
      row.domainCodes.forEach((code) => counts.set(code, (counts.get(code) ?? 0) + 1)),
    );
    return [...counts.entries()]
      .map(([code, count]) => ({ label: domainName(code), count }))
      .sort((a, b) => b.count - a.count);
  }, [rows, domainName]);

  /**
   * 贡献组织排行。取前十——自由文本字段（N18）下取值发散，全画出来会是一条几十行的长条，
   * 而看这张图的目的是「哪几个组织在产出案例」。
   */
  const byOrg = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.contributingOrg, (counts.get(row.contributingOrg) ?? 0) + 1));
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows]);

  return (
    <>
      {loaded.data?.truncated && (
        <Alert
          type="warning"
          showIcon
          style={{ gridColumn: '1 / -1' }}
          message="数据没有取完"
          description={`共 ${loaded.data.total} 条案例，本页只统计了前 ${rows.length} 条。这几张图按实时全量聚合设计，出现这条提示说明数据量已超出前端聚合的适用范围，请反馈以便改为后端统计。`}
        />
      )}

      <AnalyticsCard
        title="按案例状态分布"
        note="档位顺序即需求 5.9 转换表的流程顺序。案例只能由课程标注达精品时自动产生，因此第一档的数量就是等着运营开工的积压量"
      >
        <Spin spinning={loaded.isLoading}>
          <FunnelChart items={byState} emptyText="还没有案例" />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard
        title="按应用领域分布"
        note={`应用领域可多选，一条案例会计入多个领域，因此各条之和大于案例总数（共 ${rows.length} 条）`}
      >
        <Spin spinning={loaded.isLoading}>
          <BarChart items={byDomain} emptyText="还没有案例填写应用领域" />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard
        title="贡献组织 Top 10"
        note="贡献组织是自由文本，写法不统一的会算成两个组织。这张图不是组织覆盖率——一期不导入组织架构，覆盖率没有分母（N12）"
      >
        <Spin spinning={loaded.isLoading}>
          <BarChart items={byOrg} emptyText="还没有案例" labelWidth={120} />
        </Spin>
      </AnalyticsCard>
    </>
  );
}
