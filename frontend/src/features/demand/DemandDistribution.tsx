import { useMemo } from 'react';
import { Alert, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { demandApi, type Demand } from '@/shared/api/demands';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { FunnelChart } from '@/shared/ui/MiniChart';
import {
  DEMAND_OBJECT_TYPE_CODE,
  DEMAND_STATE_FIELDS,
  FIELD_ENUM_KEYS,
  useFieldEnums,
  useMachines,
  useOutlets,
} from './demandMeta';
import { countByStates, devStateOf, solutionBucketOf } from './demandSituation';

/**
 * 需求态势图（需求 8.2 的 P1-3）：评审 / 解决方案 / 开发三张切片，各带数量与占比。
 *
 * <p>三张图都用后端已有的列表接口在前端聚合，不建预聚合（U2、C14）。
 * 档位顺序取状态机与字段枚举（纪律 STK-1）。图上是当前存量，不是转化率。
 */

const PAGE_SIZE = 200;
const MAX_PAGES = 10;

interface Loaded {
  rows: Demand[];
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
  const machines = useMachines();
  const fieldEnums = useFieldEnums();
  const outlets = useOutlets();
  const pendingOutput = fieldEnums.data?.[FIELD_ENUM_KEYS.solutionPendingOutput]?.[0];

  const loaded = useQuery({
    queryKey: ['demands', 'overview'],
    queryFn: loadAll,
  });

  const rows = useMemo(() => loaded.data?.rows ?? [], [loaded.data]);

  const reviewStates =
    machines.data?.find(
      (m) => m.objectType === DEMAND_OBJECT_TYPE_CODE && m.stateField === DEMAND_STATE_FIELDS.review,
    )?.states ?? [];
  const solutionMachineStates =
    machines.data?.find(
      (m) => m.objectType === DEMAND_OBJECT_TYPE_CODE && m.stateField === DEMAND_STATE_FIELDS.solution,
    )?.states ?? [];
  const devStates =
    machines.data?.find(
      (m) => m.objectType === DEMAND_OBJECT_TYPE_CODE && m.stateField === DEMAND_STATE_FIELDS.dev,
    )?.states ?? [];

  const solutionStates = [pendingOutput, ...solutionMachineStates].filter(
    (item, index, all): item is string => Boolean(item) && all.indexOf(item) === index,
  );

  const byReview = useMemo(
    () => countByStates(rows, reviewStates, (row) => row.reviewState),
    [reviewStates, rows],
  );
  const bySolution = useMemo(
    () =>
      countByStates(rows, solutionStates, (row) =>
        solutionBucketOf(row, pendingOutput, outlets.solution),
      ),
    [rows, solutionStates, pendingOutput, outlets.solution],
  );
  const byDev = useMemo(
    () => countByStates(rows, devStates, (row) => devStateOf(row, outlets.development)),
    [rows, devStates, outlets.development],
  );

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

      <AnalyticsCard
        title="按需求评审状态"
        note="数量 + 占比按本图合计。图上是当前存量，不是转化率"
      >
        <Spin spinning={loaded.isLoading}>
          <FunnelChart
            items={byReview.map((item) => ({ label: item.state, count: item.value }))}
            emptyText="还没有需求数据"
          />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard
        title="按解决方案状态"
        note="仅出口一计入。数量 + 占比按本图合计"
      >
        <Spin spinning={loaded.isLoading}>
          <FunnelChart
            items={bySolution.map((item) => ({ label: item.state, count: item.value }))}
            emptyText="还没有需求进入解决方案出口"
          />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard
        title="按需求开发状态"
        note="仅出口二计入。数量 + 占比按本图合计"
      >
        <Spin spinning={loaded.isLoading}>
          <FunnelChart
            items={byDev.map((item) => ({ label: item.state, count: item.value }))}
            emptyText="还没有需求进入需求开发出口"
          />
        </Spin>
      </AnalyticsCard>
    </>
  );
}
