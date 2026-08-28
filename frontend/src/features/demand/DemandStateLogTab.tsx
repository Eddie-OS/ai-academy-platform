import { useQuery } from '@tanstack/react-query';
import { DEMAND_OBJECT_TYPE } from '@/shared/api/demands';
import { transitionApi, type StateLogRow } from '@/shared/api/transitions';
import { EM_DASH, formatDateTime } from '@/shared/format';
import './DemandDetailTabs.css';

/**
 * 需求详情「状态流转日志」时间轴（需求 5.11）。倒序：最近一次变更在最上面。
 *
 * <p>操作人一期只能区分运营／系统（C04）。需要留到具体人时，写在关联备注里。
 */

interface DemandStateLogTabProps {
  demandId: number;
}

export function DemandStateLogTab({ demandId }: DemandStateLogTabProps) {
  const logs = useQuery({
    queryKey: ['demands', demandId, 'state-logs'],
    queryFn: () => transitionApi.stateLogs(DEMAND_OBJECT_TYPE, demandId),
  });

  const items = [...(logs.data ?? [])].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  if (logs.isLoading) {
    return <p className="dmd-detail-empty">正在加载状态流转日志…</p>;
  }
  if (items.length === 0) {
    return <p className="dmd-detail-empty">还没有状态变更记录</p>;
  }

  return (
    <ol className="dmd-state-timeline" aria-label="状态流转日志">
      {items.map((row, index) => (
        <li className="dmd-state-item" key={`${row.changedAt}-${row.stateField}-${row.toState}-${index}`}>
          <span className="dmd-state-dot" aria-hidden />
          <p className="dmd-state-time">{formatDateTime(row.changedAt)}</p>
          <dl className="dmd-state-meta">
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
  );
}

export function changeText(row: Pick<StateLogRow, 'fromState' | 'toState'>): string {
  return `${row.fromState ?? '（空）'} → ${row.toState}`;
}

export function operatorLabel(accountType: StateLogRow['accountType']): string {
  return accountType === 'SYSTEM' ? '系统' : '运营';
}
