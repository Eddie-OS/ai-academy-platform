import { useState } from 'react';
import { App, Button, Space, Table } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingPlan, type TrainingSession } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { AddAttendeesModal } from './SessionAttendeesTab';

/**
 * 产品详情「参训学员」：按规格展示计划／场次／名单。
 *
 * <p>Excel 名单走导入中心，不在弹窗里另开上传（需求 13.8：导入是全页向导）。
 * 部门取人员台账快照，不做部门维度统计（N18）。
 * 参训备注目前落在签到备注上，名单行本身没有独立备注列。
 */

interface TrainingProductAttendeesProps {
  plan: TrainingPlan;
  session: TrainingSession;
}

export function TrainingProductAttendees({ plan, session }: TrainingProductAttendeesProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [adding, setAdding] = useState(false);

  const board = useQuery({
    queryKey: ['training-sessions', session.id, 'attendees'],
    queryFn: () => trainingApi.attendees(session.id),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-sessions', session.id, 'attendees'] });
    void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
  };

  const remove = useMutation({
    mutationFn: (attendeeId: number) => trainingApi.removeAttendee(session.id, attendeeId),
    onSuccess: () => {
      message.success('已从参训名单移除');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败，请重试'),
  });

  const rows = board.data?.rows ?? [];
  const sessionLabel = session.sessionName?.trim() || session.sessionNo;

  return (
    <div className="trn-prod-attendees">
      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">关联信息</h3>
        <dl className="trn-prod-kv">
          <div className="trn-prod-field" data-testid="product-attendee-meta">
            <dt>关联培训计划</dt>
            <dd>{plan.planName}</dd>
          </div>
          <div className="trn-prod-field" data-testid="product-attendee-meta">
            <dt>关联培训场次</dt>
            <dd>
              {sessionLabel}
              <span className="trn-prod-field-extra">选定后不可改；要换场请到「培训场次记录」</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="trn-prod-section">
        <div className="trn-prod-attendees-head">
          <h3 className="trn-prod-section-title">参训学员名单</h3>
          {isOperator && (
            <Space size={8}>
              <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
                添加人员
              </Button>
              <Link to="/imports">
                <Button type="primary" icon={<Upload size={14} />}>
                  去导入中心上传 Excel
                </Button>
              </Link>
            </Space>
          )}
        </div>
        <p className="trn-prod-attendees-hint">
          名单用导入中心的「参训名单」模板上传。部门来自人员台账快照，这里不做部门汇总。
        </p>

        <Table
          size="small"
          rowKey={(row) => String(row.id)}
          dataSource={rows}
          loading={board.isLoading}
          pagination={false}
          locale={{ emptyText: '还没有参训学员。可手工添加，或到导入中心上传 Excel。' }}
          columns={[
            { title: '姓名', dataIndex: 'employeeName', width: 100 },
            { title: '工号', dataIndex: 'employeeNo', width: 110 },
            {
              title: '学员部门',
              dataIndex: 'deptName',
              width: 160,
              render: (value: string | null) => value || EM_DASH,
            },
            {
              title: '记录创建时间',
              dataIndex: 'createdAt',
              width: 160,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: '参训备注',
              dataIndex: 'attendRemark',
              render: (value: string | null) => value || EM_DASH,
            },
            ...(isOperator
              ? [
                  {
                    title: '操作',
                    key: 'actions',
                    width: 88,
                    align: 'right' as const,
                    render: (_: unknown, row: (typeof rows)[number]) => (
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() =>
                          modal.confirm({
                            title: `把 ${row.employeeName} 移出参训名单`,
                            content:
                              '移出后这个人不再计入名单人数。签到记录本身保留，重新加入即可再看到。',
                            okText: '移出',
                            okButtonProps: { danger: true },
                            cancelText: '取消',
                            onOk: () => remove.mutateAsync(row.id),
                          })
                        }
                      >
                        移出
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>

      <AddAttendeesModal
        open={adding}
        sessionId={session.id}
        existing={rows.map((row) => row.employeeNo)}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          refresh();
        }}
      />
    </div>
  );
}
