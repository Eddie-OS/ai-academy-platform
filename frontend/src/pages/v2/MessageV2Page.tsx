import { useMemo, useState, type ReactNode } from 'react';
import { App } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  BellRing,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  Lightbulb,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Target,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ASSETS } from '@/shared/theme/designTokensV2';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import { isRegressionMode } from '@/app/regressionMode';
import { ApiError } from '@/shared/api/client';
import {
  escalationsApi,
  type EscalationRecord as ApiRecord,
  type OwnerGroup,
  type PendingItem,
} from '@/shared/api/escalations';
import {
  ESCALATION_DIGEST_GROUPS,
  ESCALATION_KPIS,
  ESCALATION_RECORDS,
  ESCALATION_SELECTED_ID,
  ESCALATION_TABS,
  escalationCount,
  inferEscalationKind,
  type EscalationLight,
  type EscalationObjectKind,
  type EscalationRecord,
  type EscalationTabId,
} from '@/fixtures/escalation';
import './MessageV2Page.css';

/**
 * P08 消息中心（V-1）：沿用 V2.0 三栏几何，内容是催办记录台账。
 *
 * <p>界面标题是「消息中心」，语义是催办台账（MSG1：系统不发任何消息）。
 * 视觉密度对齐设计稿六模块，但不提供发送、送达、重发、渠道、未读／已读。
 */
export function MessageV2Page() {
  const regression = isRegressionMode();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<EscalationTabId>('all');
  const [selectedId, setSelectedId] = useState(ESCALATION_SELECTED_ID);
  const [selectedPendingKey, setSelectedPendingKey] = useState<string | null>(null);

  const pendingQ = useQuery({
    queryKey: ['escalations', 'pending'],
    queryFn: () => escalationsApi.pending(),
    enabled: !regression && tab === 'pending',
  });
  const ledgerQ = useQuery({
    queryKey: ['escalations', 'ledger', tab],
    queryFn: () =>
      escalationsApi.page({
        pageNum: 1,
        pageSize: 50,
        source: tab === 'manual' ? '运营手动' : undefined,
      }),
    enabled: !regression && tab !== 'pending',
  });

  const mark = useMutation({
    mutationFn: (payload: { item: PendingItem; ownerNo?: string | null; ownerName?: string | null; force?: boolean }) =>
      escalationsApi.mark({
        objectType: payload.item.objectType,
        objectId: payload.item.objectId,
        objectName: payload.item.objectName,
        ownerNo: payload.ownerNo,
        ownerName: payload.ownerName,
        escalateType: payload.item.escalateType,
        processNode: payload.item.currentState,
        light: payload.item.light,
        source: '系统生成清单',
        content: payload.item.defaultContent,
        force: payload.force,
      }),
    onSuccess: () => {
      message.success('已记入催办台账');
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
    onError: (e, variables) => {
      if (e instanceof ApiError && e.code === 'URGE_TOO_FREQUENT') {
        modal.confirm({
          title: '确认再次记录？',
          content: e.message,
          okText: '仍要标记已催办',
          onOk: () => mark.mutateAsync({ ...variables, force: true }),
        });
        return;
      }
      message.error(e instanceof ApiError ? e.message : '标记失败');
    },
  });

  const fixtureRecords = useMemo(() => {
    if (tab === 'pending') return ESCALATION_RECORDS.filter((record) => record.pending);
    if (tab === 'manual') return ESCALATION_RECORDS.filter((record) => record.source === '运营手动');
    return ESCALATION_RECORDS;
  }, [tab]);

  const liveRecords: EscalationRecord[] = useMemo(() => {
    return (ledgerQ.data?.records ?? []).map(mapLedger);
  }, [ledgerQ.data]);

  const pendingGroups = pendingQ.data?.groups ?? [];

  /*
   * 产品模式一律以接口为准。图2 那种站内信／渠道／已读能力一期不做（MSG1）；本页只做催办台账。
   *
   * 先前接口空、报错或在途时会退回 ESCALATION_RECORDS「避免列表 0 条闪一下」。这一页尤其
   * 不能这么做：<b>催办台账是「谁在什么时候催过谁」的凭据</b>（需求 13.9）。一屏认不出来的
   * 假记录会让运营以为某条已经催过——而防重复窗口（URGE_TOO_FREQUENT，默认 24 小时）
   * 算的是真库里的记录，两边对不上。
   */
  const records = regression ? fixtureRecords : liveRecords;
  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  const kpis = regression
    ? ESCALATION_KPIS
    : [
        { id: 'pending', label: '待催办清单', value: String(pendingQ.data?.summary.pendingCount ?? '—'), tone: 'info' },
        {
          id: 'recordedToday',
          label: '今日已记台账',
          value: String(pendingQ.data?.summary.urgedThisCycle ?? ledgerQ.data?.total ?? '—'),
          tone: 'success',
        },
        { id: 'objects', label: '涉及对象', value: String(ledgerQ.data?.total ?? '—'), tone: 'brand' },
        {
          id: 'blocked',
          label: '防重复拦截',
          value: String(pendingQ.data?.summary.redUnurgedOver7Days ?? '—'),
          tone: 'warning',
        },
      ];

  const mockSystem = ESCALATION_RECORDS.filter((r) => r.source === '系统生成清单').length;
  const mockManual = ESCALATION_RECORDS.filter((r) => r.source === '运营手动').length;
  const recent = records.slice(0, 3);

  return (
    <div className="esc v2-page">
      <Tabs active={tab} onChange={setTab} />
      <KpiRow items={kpis} showDelta={regression} />
      {/* 壳层已经有一个 <main>，这里再套一个会出现两个主区地标（SC 1.3.1）。
          几何靠 .esc-main 这个类，换成 div 不影响任何基线 */}
      <div className="esc-main">
        {tab === 'pending' && !regression ? (
          <PendingList
            groups={pendingGroups}
            selectedKey={selectedPendingKey}
            onSelect={setSelectedPendingKey}
            onMark={(item, group) =>
              mark.mutate({ item, ownerNo: group.ownerNo, ownerName: group.ownerName })
            }
          />
        ) : (
          <LedgerList
            records={records}
            selectedId={selected?.id ?? ''}
            onSelect={setSelectedId}
            loading={!regression && ledgerQ.isPending}
            failed={!regression && ledgerQ.isError}
          />
        )}
        {selected ? (
          <EscalationDetail record={selected} />
        ) : (
          <section className="panel esc-detail" data-region="R6" aria-label="催办记录详情">
            <p className="esc-detail-note">左侧选中一条催办记录后，这里显示它的内容与催办轨迹。</p>
          </section>
        )}
        <SummaryPanel
          weekCount={regression ? 5 : (pendingQ.data?.summary.urgedThisCycle ?? 0)}
          systemCount={regression ? mockSystem : liveRecords.filter((r) => r.source === '系统生成清单').length}
          manualCount={regression ? mockManual : liveRecords.filter((r) => r.source === '运营手动').length}
          recent={recent}
          useDigestGroups={regression}
          digest={records.filter((r) => r.light !== 'BLUE').slice(0, 4)}
        />
      </div>
    </div>
  );
}

function mapLedger(row: ApiRecord): EscalationRecord {
  const light = (row.light as EscalationLight) || 'YELLOW';
  const objectName = row.objectName;
  return {
    id: String(row.id),
    objectName,
    owner: row.ownerName ?? row.ownerNo ?? '—',
    node: row.processNode ?? '—',
    light,
    lightLabel: lightLabel(light),
    urgedAt: row.escalatedAt?.replace('T', ' ').slice(0, 16) ?? '—',
    content: row.content ?? '—',
    source: row.source === '运营手动' ? '运营手动' : '系统生成清单',
    kind: inferEscalationKind(objectName),
  };
}

function lightLabel(light: EscalationLight): string {
  if (light === 'BLUE') return '正常运行';
  if (light === 'YELLOW') return '需要关注';
  return '逾期或停滞';
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
  objects: Target,
  blocked: ShieldAlert,
};

type KpiItem = {
  id: string;
  label: string;
  value: string;
  delta?: string;
  period?: string;
  tone?: string;
};

function KpiRow({ items, showDelta }: { items: readonly KpiItem[]; showDelta: boolean }) {
  return (
    <section className="esc-kpis" data-region="R4" aria-label="催办台账指标">
      {items.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id] ?? BellRing;
        const warn = kpi.delta?.startsWith('-');
        return (
          <article
            className="esc-kpi"
            data-testid="escalation-kpi"
            data-kpi={kpi.id}
            data-tone={kpi.tone ?? 'brand'}
            key={kpi.id}
          >
            <div className="esc-kpi-text">
              <p className="esc-kpi-label">{kpi.label}</p>
              <strong className="esc-kpi-value"><AnimatedNumber value={kpi.value} duration={520} /></strong>
              {showDelta && kpi.delta ? (
                <p className="esc-kpi-delta" data-warn={warn ? 'true' : undefined}>
                  <span>{kpi.delta}</span>
                  <span className="esc-kpi-period">{kpi.period ?? '较昨日'}</span>
                </p>
              ) : null}
            </div>
            <span className="esc-kpi-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
          </article>
        );
      })}
    </section>
  );
}

const KIND_ICONS: Record<EscalationObjectKind, LucideIcon> = {
  course: BookOpen,
  demand: Lightbulb,
  training: CalendarDays,
  kase: Trophy,
  other: BellRing,
};

function KindIcon({ kind }: { kind: EscalationObjectKind }) {
  const Icon = KIND_ICONS[kind] ?? BellRing;
  return (
    <span className="esc-kind-icon" data-kind={kind} aria-hidden>
      <Icon size={16} strokeWidth={1.75} />
    </span>
  );
}

function PendingList({
  groups,
  selectedKey,
  onSelect,
  onMark,
}: {
  groups: OwnerGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMark: (item: PendingItem, group: OwnerGroup) => void;
}) {
  return (
    <section className="panel esc-list" data-region="R5" aria-label="待催办清单">
      <header className="panel-head">
        <h2 className="panel-title">待催办清单</h2>
        <span className="panel-count">{groups.reduce((n, g) => n + g.items.length, 0)}</span>
      </header>
      <div className="esc-list-body">
        {groups.length === 0 ? (
          <p className="esc-detail-note">当前周期没有待催办对象。</p>
        ) : (
          groups.map((group) => (
            <div key={group.ownerNo ?? 'none'} className="esc-owner-group">
              <header className="esc-row-head">
                <strong>{group.ownerName ?? group.ownerNo ?? '未指定负责人'}</strong>
                <span className="esc-row-meta">
                  任务 {group.dimensions.tasks.openCount} · 需求灯{' '}
                  {group.dimensions.demands.red}/{group.dimensions.demands.yellow}/
                  {group.dimensions.demands.blue}
                </span>
              </header>
              {group.items.map((item) => {
                const key = `${item.objectType}-${item.objectId}`;
                return (
                  <button
                    type="button"
                    className="esc-row"
                    key={key}
                    data-testid="escalation-pending-row"
                    data-selected={key === selectedKey}
                    onClick={() => onSelect(key)}
                  >
                    <KindIcon kind={inferEscalationKind(item.objectName)} />
                    <span className="esc-row-main">
                      <span className="esc-row-head">
                        <strong>{item.objectName}</strong>
                        {item.light ? (
                          <LightBadge
                            light={item.light as EscalationLight}
                            label={item.urgedLabel ?? lightLabel(item.light as EscalationLight)}
                          />
                        ) : null}
                      </span>
                      <span className="esc-row-content">{item.defaultContent}</span>
                      <span className="esc-row-meta">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMark(item, group);
                          }}
                        >
                          标记已催办
                        </button>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function LedgerList({
  records,
  selectedId,
  onSelect,
  loading,
  failed,
}: {
  records: readonly EscalationRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
  failed: boolean;
}) {
  return (
    <section className="panel esc-list" data-region="R5" aria-label="催办记录列表">
      <header className="panel-head">
        <h2 className="panel-title">催办记录</h2>
        <span className="panel-count">{records.length}</span>
      </header>
      <div className="esc-list-tools">
        <label className="esc-list-search">
          <Search size={14} aria-hidden />
          <input placeholder="搜索对象 / 催办内容" readOnly />
        </label>
        <button type="button" className="esc-list-filter">
          全部类型 <ChevronDown size={12} aria-hidden />
        </button>
        <button type="button" className="esc-list-filter">
          全部来源 <ChevronDown size={12} aria-hidden />
        </button>
        <button type="button" className="esc-list-filter">
          最近记入 <ChevronDown size={12} aria-hidden />
        </button>
      </div>
      <div className="esc-list-body">
        {records.length === 0 ? (
          /* 加载中、加载失败、真的没有记录——各说一句。都写「暂无」会把接口故障说成没催办过 */
          <p className="esc-detail-note" data-testid="escalation-empty">
            {loading
              ? '正在载入催办记录…'
              : failed
                ? '催办记录加载失败，请刷新重试'
                : '还没有催办记录。到「待催办清单」页签挑对象标记已催办，记录会汇总到这里（系统不发消息，只记台账）。'}
          </p>
        ) : null}
        {records.map((record) => (
          <button
            type="button"
            className="esc-row"
            key={record.id}
            data-testid="escalation-row"
            data-selected={record.id === selectedId}
            onClick={() => onSelect(record.id)}
          >
            <KindIcon kind={record.kind} />
            <span className="esc-row-main">
              <span className="esc-row-head">
                <strong>{record.objectName}</strong>
                <LightBadge light={record.light} label={record.lightLabel} />
              </span>
              <span className="esc-row-content">{record.content}</span>
              <span className="esc-row-meta">
                <span>负责人 {record.owner}</span>
                <span>来源 {record.source}</span>
                <span>{record.urgedAt}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <footer className="esc-list-foot">
        <span>共 {records.length} 条</span>
        <span>‹ 1 ›</span>
      </footer>
    </section>
  );
}

function EscalationDetail({ record }: { record: EscalationRecord }) {
  return (
    <section className="panel esc-detail" data-region="R6" aria-label="催办记录详情">
      <header className="esc-detail-head">
        <span className="esc-detail-icon" aria-hidden>
          <BellRing size={20} />
        </span>
        <div className="esc-detail-titles">
          <p className="esc-detail-type">催办提醒 · {record.source}</p>
          <h2 data-testid="escalation-detail-title">{record.objectName}</h2>
        </div>
        <div className="esc-detail-actions">
          <button type="button" className="esc-btn esc-btn-primary">
            标记已催办
          </button>
          <button type="button" className="esc-btn esc-btn-ghost" aria-label="更多">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </header>
      <div className="esc-detail-body">
        <DetailItem label="催办对象" value={record.objectName} />
        <DetailItem label="处理节点" value={record.node} />
        <DetailItem label="灯色" value={<LightBadge light={record.light} label={record.lightLabel} />} />
        <DetailItem label="催办内容" value={record.content} multiline />
        <DetailItem label="记入时间" value={record.urgedAt} />
        <DetailItem label="来源" value={record.source} />

        <section className="esc-timeline" aria-label="催办轨迹">
          <h3>催办轨迹</h3>
          <ol>
            <li>
              <span className="esc-timeline-dot" data-tone="brand" aria-hidden />
              <div>
                <strong>记入台账</strong>
                <span>
                  {record.urgedAt} · {record.source}
                </span>
              </div>
            </li>
            <li>
              <span className="esc-timeline-dot" data-tone="warning" aria-hidden />
              <div>
                <strong>灯色判定</strong>
                <span>{record.lightLabel}</span>
              </div>
            </li>
            <li>
              <span className="esc-timeline-dot" data-tone="muted" aria-hidden />
              <div>
                <strong>待运营跟进</strong>
                <span>完成后请用「标记已催办」回写台账</span>
              </div>
            </li>
          </ol>
        </section>

        <div className="esc-related">
          <h3>关联对象</h3>
          <div className="esc-related-row">
            <span>{record.objectName}</span>
            <button type="button" className="esc-btn esc-btn-link">
              查看对象
            </button>
          </div>
        </div>
      </div>
      <p className="esc-detail-note">本页仅记录催办台账，不发送任何消息。操作请用「标记已催办」。</p>
    </section>
  );
}

function DetailItem({ label, value, multiline = false }: { label: string; value: ReactNode; multiline?: boolean }) {
  return (
    <div className="esc-detail-item" data-multiline={multiline}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const DIGEST_ICONS: Record<string, LucideIcon> = {
  yellow: AlarmClock,
  red: CircleAlert,
  blue: Clock3,
  manual: ClipboardList,
};

function SummaryPanel({
  weekCount,
  systemCount,
  manualCount,
  recent,
  useDigestGroups,
  digest,
}: {
  weekCount: number;
  systemCount: number;
  manualCount: number;
  recent: readonly EscalationRecord[];
  useDigestGroups: boolean;
  digest: readonly EscalationRecord[];
}) {
  return (
    <aside className="esc-summary" data-region="R7" aria-label="催办台账辅助信息">
      <section className="panel esc-side-card esc-side-overview">
        <header className="esc-side-head">
          <h2 className="panel-title">台账概览</h2>
          <span>更多</span>
        </header>
        <dl>
          <div>
            <dt>本周催办</dt>
            <dd>{weekCount}</dd>
          </div>
          <div>
            <dt>系统生成清单</dt>
            <dd>{systemCount}</dd>
          </div>
          <div>
            <dt>运营手动记录</dt>
            <dd>{manualCount}</dd>
          </div>
        </dl>
        <ul className="esc-recent">
          {recent.map((record) => (
            <li key={record.id}>
              <span className="esc-recent-dot" aria-hidden />
              <div>
                <strong>
                  {record.owner}
                  <em>{record.urgedAt.slice(5, 16)}</em>
                </strong>
                <span>{record.content}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel esc-side-card esc-side-digest">
        <header className="esc-side-head">
          <h2 className="panel-title">系统催办摘要</h2>
          <span>更多</span>
        </header>
        {useDigestGroups ? (
          <ul className="esc-digest-groups">
            {ESCALATION_DIGEST_GROUPS.map((group) => {
              const Icon = DIGEST_ICONS[group.id] ?? BellRing;
              return (
                <li key={group.id} data-tone={group.tone}>
                  <span className="esc-digest-icon" aria-hidden>
                    <Icon size={14} strokeWidth={1.75} />
                  </span>
                  <span className="esc-digest-label">{group.label}</span>
                  <strong>{group.count}</strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="esc-digest-list">
            {digest.map((record) => (
              <li key={record.id}>
                <span className="esc-digest-dot" data-light={record.light} aria-hidden />
                <div>
                  <strong>{record.objectName}</strong>
                  <span>{record.lightLabel}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel esc-side-card esc-side-help">
        <img src={ASSETS.A10} alt="" aria-hidden />
        <p>需要帮助？催办并记录，便于运营统一汇总后续处理。</p>
        <div className="esc-help-actions">
          <button type="button" className="esc-btn esc-btn-primary">
            查看说明
          </button>
          <button type="button" className="esc-btn esc-btn-ghost">
            联系运营
          </button>
        </div>
      </section>
    </aside>
  );
}

function LightBadge({ light, label }: { light: EscalationLight; label: string }) {
  const Icon = light === 'BLUE' ? Clock3 : CircleAlert;
  return (
    <span className="esc-light" data-light={light}>
      <Icon size={12} aria-hidden />
      {label}
    </span>
  );
}
