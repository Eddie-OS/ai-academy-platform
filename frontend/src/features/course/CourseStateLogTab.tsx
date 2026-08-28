import { Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { COURSE_OBJECT_TYPE } from '@/shared/api/courses';
import { transitionApi, type StateLogRow } from '@/shared/api/transitions';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';
import './CourseStateLogTab.css';

/**
 * 课程详情「状态流转日志」（需求 5.11）。倒序时间轴：最近一次变更在最上面。
 *
 * <p>五个状态字段混排在一条线上。操作人一期只能区分运营／系统（C04）。
 */

interface CourseStateLogTabProps {
  courseId: number;
}

export function CourseStateLogTab({ courseId }: CourseStateLogTabProps) {
  const logs = useQuery({
    queryKey: ['courses', courseId, 'state-logs'],
    queryFn: () => transitionApi.stateLogs(COURSE_OBJECT_TYPE, courseId),
  });

  const items = [...(logs.data ?? [])].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  const note = (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: space.md }}
      message="状态流转日志由系统自动留痕"
      description="每次状态变更都会写入这里，不能手工改写。要改状态请到对应阶段页签点动作。"
    />
  );

  if (logs.isLoading) {
    return (
      <>
        {note}
        <p className="crs-state-empty">正在加载状态流转日志…</p>
      </>
    );
  }
  if (items.length === 0) {
    return (
      <>
        {note}
        <p className="crs-state-empty">还没有状态变更记录</p>
      </>
    );
  }

  return (
    <>
    {note}
    <ol className="crs-state-timeline" aria-label="状态流转日志">
      {items.map((row, index) => (
        <li className="crs-state-item" key={`${row.changedAt}-${row.stateField}-${row.toState}-${index}`}>
          <span className="crs-state-dot" aria-hidden />
          <p className="crs-state-time">{formatDateTime(row.changedAt)}</p>
          <dl className="crs-state-meta">
            <div>
              <dt>变更内容</dt>
              <dd>{changeText(row)}</dd>
            </div>
            <div>
              <dt>操作人</dt>
              <dd>{operatorLabel(row.accountType)}</dd>
            </div>
            <div>
              <dt>关联备注</dt>
              <dd>{row.remark?.trim() ? row.remark : EM_DASH}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
    </>
  );
}

export function changeText(row: Pick<StateLogRow, 'stateField' | 'fromState' | 'toState'>): string {
  return `${row.stateField}：[${row.fromState ?? '空'}] 变为 [${row.toState}]`;
}

export function operatorLabel(accountType: StateLogRow['accountType']): string {
  return accountType === 'SYSTEM' ? '系统' : '运营';
}
