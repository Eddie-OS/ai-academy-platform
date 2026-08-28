import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Tabs, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { WarningLightCell } from '@/shared/ui/WarningLight';
import { warningsApi, type WarningDetailItem, type WarningLightColor } from '@/shared/api/warnings';
import { formatMetricInt } from '@/shared/metrics/cockpitMetrics';
import { objectDetailPath } from '@/shared/routing/objectDetailPath';
import { space, warningLight } from '@/shared/theme/designTokens';

const LIGHT_TABS: WarningLightColor[] = ['BLUE', 'YELLOW', 'RED'];

/**
 * 三色灯预警明细（需求 7.5）。健康对象数仅在汇总展示、不可下钻。
 */
export function WarningsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('light') as WarningLightColor | null;
  const active = raw && LIGHT_TABS.includes(raw) ? raw : 'RED';

  const summary = useQuery({
    queryKey: ['warnings', 'summary'],
    queryFn: () => warningsApi.summary(),
  });
  const list = useQuery({
    queryKey: ['warnings', 'list', active],
    queryFn: () => warningsApi.list(active, 200),
  });

  const columns = useMemo(
    () => [
      { title: '对象类型', dataIndex: 'objectType', width: 120 },
      {
        title: '对象名称',
        dataIndex: 'objectName',
        render: (name: string, row: WarningDetailItem) => (
          <Link to={objectDetailPath(row.objectType, row.objectId)}>{name}</Link>
        ),
      },
      { title: '当前状态', dataIndex: 'currentState', width: 120 },
      {
        title: '负责人',
        width: 120,
        render: (_: unknown, row: WarningDetailItem) => row.ownerName ?? row.ownerNo ?? '—',
      },
      {
        title: '预计完成',
        dataIndex: 'expectFinishDate',
        width: 120,
        render: (v: string | null) => v ?? '—',
      },
      {
        title: '灯色',
        width: 160,
        render: (_: unknown, row: WarningDetailItem) => (
          <WarningLightCell
            light={row.light}
            lightDays={row.lightDays}
            lightReason={row.lightReason}
          />
        ),
      },
    ],
    [],
  );

  const counts = summary.data;

  return (
    <div style={{ padding: space.lg }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        预警明细
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        健康对象 {counts ? formatMetricInt(counts.healthy) : '—'}（不可下钻）·{' '}
        {warningLight.BLUE.label} {counts ? formatMetricInt(counts.blue) : '—'} ·{' '}
        {warningLight.YELLOW.label} {counts ? formatMetricInt(counts.yellow) : '—'} ·{' '}
        {warningLight.RED.label} {counts ? formatMetricInt(counts.red) : '—'}
      </Typography.Paragraph>
      <Tabs
        activeKey={active}
        onChange={(key) => setParams({ light: key })}
        items={LIGHT_TABS.map((key) => ({
          key,
          label: `${warningLight[key].label}${
            counts
              ? ` (${formatMetricInt(
                  key === 'BLUE' ? counts.blue : key === 'YELLOW' ? counts.yellow : counts.red,
                )})`
              : ''
          }`,
        }))}
      />
      <Table<WarningDetailItem>
        rowKey={(r) => `${r.objectType}-${r.objectId}`}
        loading={list.isLoading}
        dataSource={list.data ?? []}
        columns={columns}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

