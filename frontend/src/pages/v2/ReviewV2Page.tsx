import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Search, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  REVIEW_COLUMNS,
  REVIEW_DEFAULT_TAB,
  REVIEW_KPIS,
  REVIEW_RECORDS,
  REVIEW_SELECTED_ID,
  REVIEW_TABS,
  type ReviewRecord,
  type ReviewTab,
} from '@/fixtures/review';
import './ReviewV2Page.css';

/**
 * P09 评审记录中心。默认页签选「试讲记录」以确保设计稿指定的试讲选中行有对应的详情。
 */
export function ReviewV2Page() {
  const [tab, setTab] = useState<ReviewTab>(REVIEW_DEFAULT_TAB);
  const [selectedId, setSelectedId] = useState(REVIEW_SELECTED_ID);
  const records = useMemo(() => REVIEW_RECORDS.filter((record) => record.type === tab), [tab]);
  const selected = records.find((record) => record.id === selectedId) ?? records[0]!;

  function selectTab(nextTab: ReviewTab) {
    const first = REVIEW_RECORDS.find((record) => record.type === nextTab);
    setTab(nextTab);
    if (first) setSelectedId(first.id);
  }

  return (
    <div className="rvw v2-page">
      <TabBar tab={tab} onChange={selectTab} />
      <FilterBar />
      <KpiRow />
      <ReviewTable records={records} selectedId={selected.id} onSelect={setSelectedId} />
      <DetailPanel record={selected} />
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: ReviewTab; onChange: (tab: ReviewTab) => void }) {
  return (
    <nav className="rvw-tabs" data-region="R3" aria-label="评审记录分类">
      {REVIEW_TABS.map((item) => (
        <button
          key={item}
          className="rvw-tab"
          data-testid="review-tab"
          data-active={item === tab}
          type="button"
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}

function FilterBar() {
  return (
    <section className="rvw-filters" data-region="R4" aria-label="评审记录筛选">
      <label className="rvw-search">
        <Search size={16} aria-hidden />
        <input type="search" placeholder="搜索名称 / 录入人" aria-label="搜索评审记录" />
      </label>
      {['评审结果', '录入人', '评审日期'].map((label) => (
        <button className="rvw-filter" key={label} type="button">
          <span>{label}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
      ))}
    </section>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  course: ClipboardCheck,
  trial: CheckCircle2,
  demand: ClipboardCheck,
  pending: AlertTriangle,
};

function KpiRow() {
  return (
    <section className="rvw-kpis" data-region="R5" aria-label="评审指标概览">
      {REVIEW_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id]!;
        return (
          <article className="rvw-kpi" key={kpi.id} data-testid="review-kpi" data-kpi={kpi.id}>
            <span className="rvw-kpi-icon" aria-hidden>
              <Icon size={18} />
            </span>
            <div>
              <p className="rvw-kpi-label">{kpi.label}</p>
              <p className="rvw-kpi-value">{kpi.value}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ReviewTable({
  records,
  selectedId,
  onSelect,
}: {
  records: ReviewRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rvw-table-panel" data-region="R6" aria-label="评审记录列表">
      <table className="rvw-table">
        <colgroup>
          {REVIEW_COLUMNS.map((column) => (
            <col key={column.id} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {REVIEW_COLUMNS.map((column) => (
              <th key={column.id} data-column={column.id} scope="col">
                {column.id === 'select' ? <input aria-label="全选评审记录" type="checkbox" /> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const consistent = isConsistent(record);
            return (
              <tr
                key={record.id}
                data-testid="review-row"
                data-record={record.id}
                data-selected={record.id === selectedId}
                onClick={() => onSelect(record.id)}
              >
                <td>
                  <input checked={record.id === selectedId} aria-label={`选择${record.name}`} readOnly type="checkbox" />
                </td>
                <td className="rvw-name" title={record.name}>
                  {record.name}
                </td>
                <td>{record.round}</td>
                <td>{record.version}</td>
                <td>{record.reviewedAt}</td>
                <td>{record.result}</td>
                <td>{record.operator}</td>
                <td>
                  {record.lecturerConclusion ? (
                    <Consistency consistent={consistent} />
                  ) : (
                    <span className="rvw-empty">—</span>
                  )}
                </td>
                <td>
                  <button className="rvw-view" type="button">
                    查看
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function isConsistent(record: ReviewRecord): boolean {
  return Boolean(record.lecturerConclusion && record.courseConclusion === record.lecturerConclusion);
}

function Consistency({ consistent }: { consistent: boolean }) {
  const Icon = consistent ? CheckCircle2 : XCircle;
  return (
    <span className="rvw-consistency" data-consistent={consistent}>
      <Icon size={15} aria-hidden />
      {consistent ? '一致' : '不一致'}
    </span>
  );
}

function DetailPanel({ record }: { record: ReviewRecord }) {
  const inconsistent = record.lecturerConclusion && !isConsistent(record);
  return (
    <section className="rvw-detail" data-region="R7" aria-label="评审记录详情">
      <header className="rvw-detail-head">
        <div>
          <p className="rvw-detail-eyebrow">{record.type}</p>
          <h2 data-testid="review-detail-title">{record.name}</h2>
        </div>
        <span className="rvw-detail-date">{record.reviewedAt}</span>
      </header>

      {inconsistent && (
        <div className="rvw-risk" data-testid="review-risk-banner" role="alert">
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>风险提示：讲师结论与课程结论不一致</strong>
            <span>请确认课程侧结论后再进入后续流程。</span>
          </div>
        </div>
      )}

      <dl className="rvw-detail-grid">
        <div>
          <dt>评审轮次</dt>
          <dd>{record.round}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>{record.version}</dd>
        </div>
        <div>
          <dt>评审结果</dt>
          <dd>{record.result}</dd>
        </div>
        <div>
          <dt>录入人</dt>
          <dd>{record.operator}</dd>
        </div>
        {record.score && (
          <div>
            <dt>评分</dt>
            <dd>{record.score}</dd>
          </div>
        )}
      </dl>

      <div className="rvw-opinion">
        <h3>评审意见</h3>
        <p>{record.opinion}</p>
      </div>
    </section>
  );
}
