import { Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { escalationsApi, type EscalationRecord } from '@/shared/api/escalations';
import type { Demand } from '@/shared/api/demands';
import { EM_DASH, formatDateTime } from '@/shared/format';
import './DemandDetailTabs.css';

/**
 * 详情页「催办记录」页签：本条需求的「一键催办」历史。
 *
 * <p>一期不发消息，也没有回复通道。自动闭环只看催办之后需求是否又发生了状态变更
 * （{@code lastStateChangedAt}，不是 {@code updatedAt}——改错别字不该把催办标成已处理）。
 */

interface DemandEscalationsTabProps {
  demand: Demand;
}

export function DemandEscalationsTab({ demand }: DemandEscalationsTabProps) {
  const rows = useQuery({
    queryKey: ['demands', demand.id, 'escalations'],
    queryFn: () =>
      escalationsApi.page({
        objectType: 'DEMAND',
        objectId: demand.id,
        pageNum: 1,
        pageSize: 200,
      }),
  });

  const records = [...(rows.data?.records ?? [])].sort((a, b) =>
    b.escalatedAt.localeCompare(a.escalatedAt),
  );

  return (
    <Table<EscalationRecord>
      size="small"
      rowKey={(row) => String(row.id)}
      dataSource={records}
      loading={rows.isLoading}
      pagination={false}
      locale={{ emptyText: '还没有催办记录。底部「一键催办」写入台账后会出现在这里。' }}
      columns={[
        { title: '催办时间', dataIndex: 'escalatedAt', width: 136, render: formatDateTime },
        {
          title: '需求标题',
          dataIndex: 'objectName',
          ellipsis: true,
          render: (value: string | null) => value || demand.demandName || EM_DASH,
        },
        {
          title: '催办对象',
          key: 'target',
          width: 96,
          ellipsis: true,
          render: (_, row) => row.ownerName || row.ownerNo || EM_DASH,
        },
        {
          title: '状态',
          key: 'status',
          width: 88,
          render: (_, row) => {
            const status = escalationStatus(row, demand.lastStateChangedAt);
            return (
              <span className="dmd-esc-status" data-status={status === '已处理' ? 'done' : 'pending'}>
                {status}
              </span>
            );
          },
        },
      ]}
    />
  );
}

export function escalationStatus(
  record: Pick<EscalationRecord, 'escalatedAt'>,
  lastStateChangedAt: string | null | undefined,
): '已处理' | '待响应' {
  if (!lastStateChangedAt) return '待响应';
  return new Date(lastStateChangedAt).getTime() > new Date(record.escalatedAt).getTime()
    ? '已处理'
    : '待响应';
}
