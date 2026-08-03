import { Alert, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { transitionApi, type StateLogRow } from '@/shared/api/transitions';
import { formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 详情页「状态流转日志」页签（需求 5.11）。课程、需求等带状态的对象共用一份。
 *
 * <p>同一个对象的多个状态字段<b>混排在一条时间线上</b>：运营看的是「这个对象经历了什么」，
 * 而不是「主状态经历了什么」。「提交评审」与「评审记录建档」是同一次操作的两面，分开看就串不起来。
 *
 * <p><b>系统流转与人工流转必须能分辨。</b>随主状态自动置位的子状态标为「系统」——
 * 不标的话，运营会去找「是谁改的」，而共享账号下这个问题本来就没有答案。
 */

interface StateLogTabProps {
  /** 对象类型的路径段，如 {@code courses}／{@code demands}（统一转换接口的第一段） */
  objectType: string;
  objectId: number;
}

export function StateLogTab({ objectType, objectId }: StateLogTabProps) {
  const logs = useQuery({
    queryKey: [objectType, objectId, 'state-logs'],
    queryFn: () => transitionApi.stateLogs(objectType, objectId),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="日志记不到具体是谁"
        description="一期只有两个共享账号，日志里的操作账号是「运营」而不是某个人。需要留痕到人时，请在变更说明里写上姓名。"
      />

      <Table<StateLogRow>
        size="small"
        rowKey={(row) => `${row.changedAt}-${row.stateField}-${row.toState}`}
        dataSource={logs.data ?? []}
        loading={logs.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有状态变更记录' }}
        columns={[
          { title: '变更时间', dataIndex: 'changedAt', width: 160, render: formatDateTime },
          { title: '状态字段', dataIndex: 'stateField', width: 130 },
          {
            title: '变更',
            key: 'transition',
            render: (_, row) => (
              <Space size={4}>
                <Text type="secondary">{row.fromState ?? '（空）'}</Text>
                <Text type="secondary">→</Text>
                <Text strong>{row.toState}</Text>
              </Space>
            ),
          },
          { title: '动作', dataIndex: 'actionCode', width: 200 },
          {
            title: '操作账号',
            dataIndex: 'accountType',
            width: 100,
            render: (type: StateLogRow['accountType']) =>
              type === 'SYSTEM' ? <Tag>系统自动</Tag> : <Tag color="blue">运营</Tag>,
          },
          { title: '变更说明', dataIndex: 'remark', render: (v: string | null) => v ?? '—' },
        ]}
      />
    </Space>
  );
}
