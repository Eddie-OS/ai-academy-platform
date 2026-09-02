import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingSession } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { formatTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';
import { TrainingSessionFormModal, useSchedulingWarnings } from './TrainingSessionFormModal';

const { Text } = Typography;

/**
 * 计划详情的「下属场次」页签（需求 11.2 P4-3）。
 *
 * <p>新建场次的入口在这里而不在场次列表页：场次号是「计划号-序号」，脱离计划的场次不存在。
 *
 * <p>一个计划下的场次是个位到几十的量级，一次取满 200 条不分页——分页会让「这个计划一共排了
 * 几场、哪几天」这个最常见的问题变成翻页操作。
 */

const MAX_SESSIONS_PER_PLAN = 200;

interface PlanSessionsTabProps {
  planId: number;
  courseId: number;
  /** 产品详情里点场次名切到本弹窗的场次，不跳业务页 */
  selectedSessionId?: number;
  onSelectSession?: (session: TrainingSession) => void;
}

export function PlanSessionsTab({
  planId,
  courseId,
  selectedSessionId,
  onSelectSession,
}: PlanSessionsTabProps) {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const showWarnings = useSchedulingWarnings();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TrainingSession | null>(null);

  const sessions = useQuery({
    queryKey: ['training-sessions', 'of-plan', planId],
    queryFn: () => trainingApi.sessions({ planId }, 1, MAX_SESSIONS_PER_PLAN),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['training-plans'] });
  };

  const remove = useMutation({
    mutationFn: (id: number) => trainingApi.deleteSession(id),
    onSuccess: () => {
      message.success('场次已删除');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const rows = sessions.data?.records ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      {isOperator && (
        <div>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            新建场次
          </Button>
        </div>
      )}

      <Table<TrainingSession>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={rows}
        loading={sessions.isLoading}
        pagination={false}
        locale={{ emptyText: '这个计划下还没有场次' }}
        rowClassName={(row) => (row.id === selectedSessionId ? 'ant-table-row-selected' : '')}
        onRow={
          onSelectSession
            ? (row) => ({
                onClick: () => onSelectSession(row),
              })
            : undefined
        }
        columns={[
          { title: '场次ID', dataIndex: 'sessionNo', width: 150 },
          {
            title: '场次名称',
            dataIndex: 'sessionName',
            render: (name: string | null, row) => (
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() =>
                  onSelectSession ? onSelectSession(row) : navigate(`/training-sessions/${row.id}`)
                }
              >
                {name ?? row.sessionNo}
              </Button>
            ),
          },
          { title: '授课讲师', dataIndex: 'lecturerName', width: 110, render: (v: string | null) => v ?? '—' },
          { title: '培训日期', dataIndex: 'trainingDate', width: 112 },
          {
            title: '时间',
            key: 'time',
            width: 120,
            render: (_, row) => `${formatTime(row.startTime)} - ${formatTime(row.endTime)}`,
          },
          { title: '培训形式', dataIndex: 'trainingForm', width: 96 },
          {
            title: '计划/实际人数',
            key: 'attendee',
            width: 120,
            align: 'right',
            render: (_, row) =>
              row.planAttendeeCount === null
                ? `${row.actualAttendeeCount}`
                : `${row.planAttendeeCount} / ${row.actualAttendeeCount}`,
          },
          {
            title: '签到',
            dataIndex: 'attendanceImported',
            width: 90,
            render: (imported: boolean) =>
              imported ? <Tag color="blue">已导入</Tag> : <Text type="secondary">未导入</Text>,
          },
          { title: '场次状态', dataIndex: 'sessionState', width: 100 },
          {
            title: '操作',
            key: 'actions',
            width: 140,
            align: 'right',
            render: (_, row) =>
              isOperator ? (
                <Space size={space.sm}>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setEditing(row)}>
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    style={{ padding: 0 }}
                    onClick={() =>
                      modal.confirm({
                        title: `删除场次「${row.sessionName ?? row.sessionNo}」`,
                        content:
                          '删除后该场次的参训名单、签到与反馈一并不再展示。已发生的培训请改用状态流转记录，不要删除。',
                        okText: '删除',
                        okButtonProps: { danger: true },
                        cancelText: '取消',
                        onOk: () => remove.mutateAsync(row.id),
                      })
                    }
                  >
                    删除
                  </Button>
                </Space>
              ) : null,
          },
        ]}
      />

      <TrainingSessionFormModal
        open={creating}
        planId={planId}
        defaultCourseId={courseId}
        onClose={() => setCreating(false)}
        onSaved={(result) => {
          setCreating(false);
          refresh();
          showWarnings(result.warnings);
        }}
      />

      {editing && (
        <TrainingSessionFormModal
          open
          planId={planId}
          session={editing}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null);
            refresh();
            showWarnings(result.warnings);
          }}
        />
      )}
    </Space>
  );
}
