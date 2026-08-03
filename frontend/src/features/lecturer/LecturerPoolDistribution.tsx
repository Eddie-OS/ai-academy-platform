import { useMemo } from 'react';
import { Alert, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type Lecturer } from '@/shared/api/lecturers';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { BarChart } from '@/shared/ui/MiniChart';
import { FIELD_ENUM_KEYS, useFieldEnums } from './lecturerMeta';

/**
 * 讲师池分布，讲师驾驶舱底部分析区的一块。
 *
 * <p><b>这不是「讲师能力地图」。</b>能力地图（按领域打分、看谁能补上哪块空白）是二期的评估
 * 模型，一期明确不做（N6、原则三）。这里画的只是已录数据的两个分布：培养状态与擅长领域。
 *
 * <p>与需求态势图一样在前端聚合，没有为它新建统计接口：讲师量级在百，实时全量聚合比维护一个
 * 只服务于一张图的接口划算（需求 U2、C14：实时计算，不建预聚合）。
 *
 * <p><b>擅长领域是多选，一名讲师会进多个柱子。</b>因此各柱之和大于讲师总数，这在图上写明了——
 * 不写的话读者会拿它当占比来算，而分母根本对不上。
 */

/** 单页上限（API-6）。逐页取直到取完；讲师量级在百，一页通常就够。 */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

interface Loaded {
  rows: Lecturer[];
  truncated: boolean;
  total: number;
}

async function loadAll(): Promise<Loaded> {
  const rows: Lecturer[] = [];
  let total = 0;
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
    const page = await lecturerApi.page({}, pageNum, PAGE_SIZE);
    total = page.total;
    rows.push(...page.records);
    if (rows.length >= page.total || page.records.length === 0) {
      return { rows, truncated: false, total };
    }
  }
  return { rows, truncated: rows.length < total, total };
}

export function LecturerPoolDistribution() {
  const fieldEnums = useFieldEnums();

  const loaded = useQuery({
    queryKey: ['lecturers', 'overview'],
    queryFn: loadAll,
  });

  const rows = useMemo(() => loaded.data?.rows ?? [], [loaded.data]);

  /** 档位顺序取后端下发的枚举顺序（待培养 → 培养中 → 可上岗），不在前端另排一遍 */
  const trainingStates = fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerTrainingState] ?? [];

  const byTrainingState = useMemo(
    () =>
      trainingStates.map((state) => ({
        label: state,
        count: rows.filter((row) => row.trainingState === state).length,
      })),
    [trainingStates, rows],
  );

  const byDomain = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) =>
      row.expertiseDomains.forEach((domain) => counts.set(domain, (counts.get(domain) ?? 0) + 1)),
    );
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <>
      {loaded.data?.truncated && (
        <Alert
          type="warning"
          showIcon
          style={{ gridColumn: '1 / -1' }}
          message="数据没有取完"
          description={`共 ${loaded.data.total} 名讲师，本页只统计了前 ${rows.length} 名。这两张图按实时全量聚合设计，出现这条提示说明数据量已超出前端聚合的适用范围，请反馈以便改为后端统计。`}
        />
      )}

      <AnalyticsCard
        title="按培养状态分布"
        note="只有「可上岗」的讲师能被排课。培养状态可由运营自由改回，它不是状态机，改动不进流转日志"
      >
        <Spin spinning={loaded.isLoading}>
          <BarChart items={byTrainingState} emptyText="讲师池里还没有人" />
        </Spin>
      </AnalyticsCard>

      <AnalyticsCard
        title="按擅长领域分布"
        note={`擅长领域可多选，一名讲师会计入多个领域，因此各条之和大于讲师总数（共 ${rows.length} 名）`}
      >
        <Spin spinning={loaded.isLoading}>
          <BarChart
            items={byDomain}
            emptyText="还没有讲师填写擅长领域。课程负责人自动入池时这一项是空的，需要运营补齐"
          />
        </Spin>
      </AnalyticsCard>
    </>
  );
}
