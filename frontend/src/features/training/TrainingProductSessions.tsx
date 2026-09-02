import { useState } from 'react';
import { App, Button, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingSession } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { EM_DASH, formatDateTime, formatTime } from '@/shared/format';
import { TrainingSessionFormModal, useSchedulingWarnings } from './TrainingSessionFormModal';

/**
 * 产品详情「培训场次记录」：按规格 12 个字段展示本计划下属场次。
 *
 * <p>授课形式与场次状态取状态机／字段枚举的真实值，不改成规格稿里的「线上直播／已完成／已取消」。
 * 实际参训人数是签到 COUNT，不是手填。
 */

const MAX_SESSIONS_PER_PLAN = 200;

interface TrainingProductSessionsProps {
  planId: number;
  courseId: number;
  selectedSessionId?: number;
  onSelectSession: (session: TrainingSession) => void;
}

export function TrainingProductSessions({
  planId,
  courseId,
  selectedSessionId,
  onSelectSession,
}: TrainingProductSessionsProps) {
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
    <div className="trn-prod-sessions">
      {isOperator && (
        <div className="trn-prod-sessions-toolbar">
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            新建场次
          </Button>
        </div>
      )}

      {sessions.isLoading ? (
        <p className="trn-prod-empty">正在读取场次记录…</p>
      ) : rows.length === 0 ? (
        <p className="trn-prod-empty">这个计划下还没有场次。</p>
      ) : (
        <ul className="trn-prod-session-list">
          {rows.map((row, index) => (
            <li key={row.id}>
              <article
                className="trn-prod-session-card"
                data-selected={row.id === selectedSessionId}
                data-testid="product-session-card"
              >
                <header className="trn-prod-session-head">
                  <button
                    type="button"
                    className="trn-prod-session-title"
                    onClick={() => onSelectSession(row)}
                  >
                    {sessionLabel(row, index)}
                  </button>
                  <span className="trn-prod-status">{row.sessionState}</span>
                </header>

                <dl className="trn-prod-kv">
                  <SessionField label="关联培训计划" value={row.planName || EM_DASH} />
                  <SessionField label="培训场次" value={sessionLabel(row, index)} />
                  <SessionField label="授课讲师" value={row.lecturerName ?? EM_DASH} />
                  <SessionField label="培训课程" value={row.courseName ?? EM_DASH} />
                  <SessionField label="授课形式" value={row.trainingForm || EM_DASH} />
                  <SessionField label="实际授课时间" value={formatTeachingTime(row)} />
                  <SessionField label="实际授课时长" value={formatDuration(row.durationHours)} />
                  <SessionField
                    label="实际参训人数"
                    value={`${row.actualAttendeeCount} 人`}
                    extra="由签到记录自动汇总"
                  />
                  <SessionField label="场次授课状态" value={row.sessionState} />
                  <SessionField
                    label="记录创建人"
                    value={row.createdBy || row.updatedBy || EM_DASH}
                    extra="系统自动写入"
                  />
                  <SessionField
                    label="记录创建时间"
                    value={formatDateTime(row.createdAt ?? row.updatedAt)}
                    extra="系统自动写入"
                  />
                  <SessionField label="备注" value={row.remark || EM_DASH} wide />
                </dl>

                {isOperator && (
                  <footer className="trn-prod-session-actions">
                    <Space size={8}>
                      <Button type="link" size="small" onClick={() => setEditing(row)}>
                        编辑
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() =>
                          modal.confirm({
                            title: `删除场次「${sessionLabel(row, index)}」`,
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
                  </footer>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
}

function SessionField({
  label,
  value,
  extra,
  wide,
}: {
  label: string;
  value: string;
  extra?: string;
  wide?: boolean;
}) {
  return (
    <div className="trn-prod-field" data-span={wide ? '2' : undefined} data-testid="product-session-field">
      <dt>{label}</dt>
      <dd>
        {value}
        {extra ? <span className="trn-prod-field-extra">{extra}</span> : null}
      </dd>
    </div>
  );
}

function sessionLabel(row: TrainingSession, index: number): string {
  if (row.sessionName?.trim()) return row.sessionName.trim();
  const seq = row.sessionNo.match(/-(\d+)$/)?.[1];
  return seq ? `第${Number(seq)}场` : `第${index + 1}场`;
}

function formatTeachingTime(row: TrainingSession): string {
  return `${row.trainingDate} ${formatTime(row.startTime)} ～ ${formatTime(row.endTime)}`;
}

function formatDuration(hours: string | null): string {
  if (hours == null || hours === '') return EM_DASH;
  const n = Number(hours);
  if (!Number.isFinite(n)) return hours;
  return `${n.toFixed(1)} 小时`;
}
