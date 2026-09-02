import { useState } from 'react';
import { Alert, App, Button, Card, Input, Modal, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingFeedbackItem } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { neutral, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 场次详情的「学员反馈」页签（需求 11.7，页面 P4-4）。
 *
 * <p><b>只能看与写运营备注。</b>反馈正文任何账号都不可修改（规则 FB1），系统内也不提供学员提交
 * 入口（规则 FB2）——界面上不留按钮。反馈从导入中心进来。
 *
 * <p><b>同一场次可多次导入，追加而非覆盖</b>（规则 FB4）：匿名反馈没有唯一键，无法判重。
 * 顶部把已有条数亮出来，就是规则 FB5 要求的那句「本场次已有 N 条反馈，本次导入将追加」。
 */

const PAGE_SIZE = 20;

interface SessionFeedbackTabProps {
  sessionId: number;
}

export function SessionFeedbackTab({ sessionId }: SessionFeedbackTabProps) {
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pageNum, setPageNum] = useState(1);
  const [remarking, setRemarking] = useState<TrainingFeedbackItem | null>(null);

  const summary = useQuery({
    queryKey: ['training-sessions', sessionId, 'feedback-summary'],
    queryFn: () => trainingApi.feedbackSummary(sessionId),
  });

  const page = useQuery({
    queryKey: ['training-sessions', sessionId, 'feedbacks', pageNum],
    queryFn: () => trainingApi.feedbacks(sessionId, pageNum, PAGE_SIZE),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-sessions', sessionId, 'feedbacks'] });
    void queryClient.invalidateQueries({
      queryKey: ['training-sessions', sessionId, 'feedback-summary'],
    });
  };

  const stats = summary.data;
  const distribution = stats
    ? [
        { score: 5, count: stats.score5 },
        { score: 4, count: stats.score4 },
        { score: 3, count: stats.score3 },
        { score: 2, count: stats.score2 },
        { score: 1, count: stats.score1 },
      ]
    : [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Card size="small">
        <Space size={space['2xl']} wrap align="start">
          <Statistic title="反馈条数" value={stats?.total ?? 0} />
          <Statistic
            title="平均分"
            // 没有反馈时后端给 null：显示「—」而不是 0.0，两者含义完全不同
            value={stats?.averageScore ?? '—'}
            suffix={stats?.averageScore ? '/ 5' : undefined}
          />
          <Statistic title="匿名条数" value={stats?.anonymousCount ?? 0} />
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              分档分布
            </Text>
            <div style={{ marginTop: space['2xs'] }}>
              <Space size={space.sm}>
                {distribution.map((item) => (
                  <Text key={item.score} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {item.score} 分 <Text strong>{item.count}</Text>
                  </Text>
                ))}
              </Space>
            </div>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message={`本场次已有 ${stats?.total ?? 0} 条反馈，再次导入将追加`}
        description="反馈没有唯一键（匿名记录无法判重），因此多次导入是追加而不是覆盖。同一份问卷导两次，评分会被计两次。"
      />

      <Table<TrainingFeedbackItem>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={page.data?.records ?? []}
        loading={page.isLoading}
        locale={{ emptyText: '还没有学员反馈。反馈从导入中心的「学员反馈导入」进来' }}
        pagination={{
          current: pageNum,
          pageSize: PAGE_SIZE,
          total: page.data?.total ?? 0,
          showSizeChanger: false,
          onChange: setPageNum,
          showTotal: (count) => `共 ${count} 条`,
        }}
        columns={[
          {
            title: '提交人',
            key: 'submitter',
            width: 160,
            // 匿名同样计入平均分（规则 FB3），匿名影响的只是能不能看到是谁写的
            render: (_, row) =>
              row.submitterNo === null ? (
                <Tag>匿名</Tag>
              ) : (
                <Space direction="vertical" size={0}>
                  <Text>{row.submitterName ?? row.submitterNo}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {row.submitterDept ?? row.submitterNo}
                  </Text>
                </Space>
              ),
          },
          {
            title: '评分',
            dataIndex: 'score',
            width: 90,
            align: 'right',
            render: (score: number) => (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score} / 5</span>
            ),
          },
          { title: '反馈内容', dataIndex: 'content', render: (v: string | null) => v ?? '—' },
          { title: '应用场景', dataIndex: 'feedbackScene', width: 160, render: (v: string | null) => v ?? '—' },
          {
            title: '导入时间',
            dataIndex: 'importedAt',
            width: 150,
            render: (value: string) => formatDateTime(value),
          },
          {
            title: '运营备注',
            key: 'opsRemark',
            width: 220,
            render: (_, row) => (
              <Space direction="vertical" size={0}>
                <Text style={{ color: row.opsRemark ? undefined : neutral[400] }}>
                  {row.opsRemark ?? '—'}
                </Text>
                {row.remarkedAt && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDateTime(row.remarkedAt)}
                  </Text>
                )}
              </Space>
            ),
          },
          {
            title: '操作',
            key: 'actions',
            width: 100,
            align: 'right',
            render: (_, row) =>
              isOperator ? (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setRemarking(row)}>
                  写备注
                </Button>
              ) : null,
          },
        ]}
      />

      {remarking && (
        <FeedbackRemarkModal
          sessionId={sessionId}
          item={remarking}
          onClose={() => setRemarking(null)}
          onSaved={() => {
            setRemarking(null);
            refresh();
          }}
        />
      )}
    </Space>
  );
}

export function FeedbackRemarkModal({
  sessionId,
  item,
  onClose,
  onSaved,
}: {
  sessionId: number;
  item: TrainingFeedbackItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [value, setValue] = useState(item.opsRemark ?? '');

  const save = useMutation({
    mutationFn: () => trainingApi.updateFeedbackRemark(sessionId, item.id, value.trim() || null),
    onSuccess: () => {
      message.success('运营备注已保存');
      onSaved();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  return (
    <Modal
      open
      title="运营备注"
      okText="保存"
      cancelText="取消"
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() => void save.mutateAsync()}
    >
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        <Card size="small" styles={{ body: { background: neutral[50] } }}>
          <Text type="secondary">学员原文（不可修改）</Text>
          <div style={{ marginTop: space['2xs'] }}>{item.content ?? '—'}</div>
        </Card>
        <Text type="secondary">
          备注写的是「我们怎么处理这条反馈」，清空备注留空保存即可。学员原文是一手数据，导错只能撤销整批重导。
        </Text>
        <Input.TextArea
          rows={4}
          maxLength={2000}
          showCount
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Space>
    </Modal>
  );
}
