import { useMemo, useState, type ReactNode } from 'react';
import { BellRing, CircleAlert, Clock3, FileText, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ASSETS } from '@/shared/theme/designTokensV2';
import {
  ESCALATION_KPIS,
  ESCALATION_RECORDS,
  ESCALATION_SELECTED_ID,
  ESCALATION_TABS,
  escalationCount,
  type EscalationLight,
  type EscalationRecord,
  type EscalationTabId,
} from '@/fixtures/escalation';
import './MessageV2Page.css';

/**
 * P08 消息中心（V-1）：沿用 V2.0 三栏几何，内容是催办记录台账。
 * 不提供发送、送达、重发、渠道或已读能力。
 */
export function MessageV2Page() {
  const [tab, setTab] = useState<EscalationTabId>('all');
  const [selectedId, setSelectedId] = useState(ESCALATION_SELECTED_ID);
  const records = useMemo(() => {
    if (tab === 'pending') return ESCALATION_RECORDS.filter((record) => record.pending);
    if (tab === 'manual') return ESCALATION_RECORDS.filter((record) => record.source === '运营手动');
    return ESCALATION_RECORDS;
  }, [tab]);
  const selected = ESCALATION_RECORDS.find((record) => record.id === selectedId) ?? ESCALATION_RECORDS[0]!;

  return (
    <div className="esc v2-page">
      <Tabs active={tab} onChange={setTab} />
      <KpiRow />
      <main className="esc-main">
        <LedgerList records={records} selectedId={selected.id} onSelect={setSelectedId} />
        <EscalationDetail record={selected} />
        <SummaryPanel />
      </main>
    </div>
  );
}

function Tabs({ active, onChange }: { active: EscalationTabId; onChange: (tab: EscalationTabId) => void }) {
  return (
    <nav className="esc-tabs" data-region="R3" aria-label="催办记录台账页签">
      {ESCALATION_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-testid="escalation-tab"
          data-active={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          <span>{escalationCount(tab.id)}</span>
        </button>
      ))}
    </nav>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  pending: Clock3,
  recordedToday: FileText,
  objects: BellRing,
  blocked: ShieldAlert,
};

function KpiRow() {
  return (
    <section className="esc-kpis" data-region="R4" aria-label="催办台账指标">
      {ESCALATION_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id]!;
        return (
          <article className="esc-kpi" data-testid="escalation-kpi" data-kpi={kpi.id} key={kpi.id}>
            <span className="esc-kpi-icon" aria-hidden><Icon size={18} /></span>
            <div>
              <p>{kpi.label}</p>
              <strong>{kpi.value}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function LedgerList({
  records, selectedId, onSelect,
}: {
  records: readonly EscalationRecord[]; selectedId: string; onSelect: (id: string) => void;
}) {
  return (
    <section className="panel esc-list" data-region="R5" aria-label="催办记录列表">
      <header className="panel-head"><h2 className="panel-title">催办记录</h2><span className="panel-count">{records.length}</span></header>
      <div className="esc-list-body">
        {records.map((record) => (
          <button
            type="button"
            className="esc-row"
            key={record.id}
            data-testid="escalation-row"
            data-selected={record.id === selectedId}
            onClick={() => onSelect(record.id)}
          >
            <span className="esc-row-head"><strong>{record.objectName}</strong><LightBadge light={record.light} label={record.lightLabel} /></span>
            <span className="esc-row-meta">{record.owner} · {record.urgedAt}</span>
            <span className="esc-row-content">{record.content}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EscalationDetail({ record }: { record: EscalationRecord }) {
  return (
    <section className="panel esc-detail" data-region="R6" aria-label="催办记录详情">
      <header className="esc-detail-head">
        <span className="esc-detail-icon" aria-hidden><BellRing size={20} /></span>
        <div><p className="esc-detail-type">催办提醒</p><h2 data-testid="escalation-detail-title">{record.objectName}</h2></div>
      </header>
      <div className="esc-detail-body">
        <DetailItem label="催办对象" value={record.objectName} />
        <DetailItem label="处理节点" value={record.node} />
        <DetailItem label="灯色" value={<LightBadge light={record.light} label={record.lightLabel} />} />
        <DetailItem label="催办内容" value={record.content} multiline />
        <DetailItem label="记入时间" value={record.urgedAt} />
        <DetailItem label="来源" value={record.source} />
      </div>
      <p className="esc-detail-note">本页仅记录催办台账，不发送任何消息。</p>
    </section>
  );
}

function DetailItem({ label, value, multiline = false }: { label: string; value: ReactNode; multiline?: boolean }) {
  return <div className="esc-detail-item" data-multiline={multiline}><dt>{label}</dt><dd>{value}</dd></div>;
}

function SummaryPanel() {
  return (
    <aside className="panel esc-summary" data-region="R7" aria-label="催办台账辅助信息">
      <h2 className="panel-title">台账概览</h2>
      <dl>
        <div><dt>本周催办</dt><dd>5</dd></div>
        <div><dt>系统生成清单</dt><dd>3</dd></div>
        <div><dt>运营手动记录</dt><dd>2</dd></div>
      </dl>
      <img src={ASSETS.A10} alt="" aria-hidden />
      <p>催办只作记录，便于运营统一追踪后续处理。</p>
    </aside>
  );
}

function LightBadge({ light, label }: { light: EscalationLight; label: string }) {
  const Icon = light === 'BLUE' ? Clock3 : CircleAlert;
  return <span className="esc-light" data-light={light}><Icon size={12} aria-hidden />{label}</span>;
}
