import { Alert, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type Lecturer, type LecturerFieldLog } from '@/shared/api/lecturers';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';
import './LecturerStateLogTab.css';

/**
 * 讲师详情「状态流转日志」。时间轴倒序，读操作审计里的上岗／培养／认证。
 *
 * <p>讲师没有状态机（TS1／TS2）。这里不是 {@code audit_state_log}，也不参与效率指标。
 */

export function fieldChangeText(row: Pick<LecturerFieldLog, 'fieldName' | 'oldValue' | 'newValue'>): string {
  return `【${row.fieldName}】由 [${row.oldValue ?? '空'}] 变更为 [${row.newValue ?? '空'}]`;
}

export function fieldLogOperator(row: Pick<LecturerFieldLog, 'accountType' | 'operatorNo' | 'operatorName'>): string {
  const name = row.operatorName?.trim();
  const no = row.operatorNo?.trim();
  if (name && no) return `${name} ${no}`;
  if (name) return name;
  if (row.accountType === 'SYSTEM') return '系统';
  if (row.accountType === 'USER') return '用户';
  return '运营';
}

export function LecturerStateLogTab({ lecturer }: { lecturer: Lecturer }) {
  const logs = useQuery({
    queryKey: ['lecturers', lecturer.id, 'field-logs'],
    queryFn: () => lecturerApi.fieldLogs(lecturer.id),
  });

  const items = logs.data ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="档案字段改值自动留痕，不是状态机"
        description="上岗、培养、认证的变更来自操作审计。不写状态流转日志，也不参与效率指标。"
      />

      <p className="lct-state-id">
        讲师ID <strong>{lecturer.lecturerNo}</strong>
        <span aria-hidden> · </span>
        {lecturer.lecturerName}
      </p>

      {logs.isLoading ? (
        <p className="lct-state-empty">正在加载状态变更记录…</p>
      ) : items.length === 0 ? (
        <p className="lct-state-empty">还没有状态变更记录</p>
      ) : (
        <ol className="lct-state-timeline" aria-label="状态流转日志">
          {items.map((row, index) => (
            <li
              className="lct-state-item"
              data-testid="field-log-item"
              key={`${row.operatedAt}-${row.fieldName}-${index}`}
            >
              <span className="lct-state-dot" aria-hidden />
              <p className="lct-state-time">{formatDateTime(row.operatedAt)}</p>
              <dl className="lct-state-meta">
                <div>
                  <dt>变更内容</dt>
                  <dd>{fieldChangeText(row)}</dd>
                </div>
                <div>
                  <dt>操作人</dt>
                  <dd>{fieldLogOperator(row)}</dd>
                </div>
                <div>
                  <dt>关联备注</dt>
                  <dd>{row.remark?.trim() ? row.remark : EM_DASH}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </Space>
  );
}
