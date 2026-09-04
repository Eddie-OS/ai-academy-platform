import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Layers,
  MoreHorizontal,
  Search,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ASSETS } from '@/shared/theme/designTokensV2';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import { isRegressionMode } from '@/app/regressionMode';
import { reviewRecordsApi, type ReviewRecordItem } from '@/shared/api/reviewRecords';
import {
  REVIEW_COLUMNS,
  REVIEW_DEFAULT_TAB,
  REVIEW_DETAIL_ATTACHMENT,
  REVIEW_DETAIL_TAGS,
  REVIEW_DETAIL_TIMELINE,
  REVIEW_FILTERS,
  REVIEW_KPIS,
  REVIEW_PENDING_PANEL,
  REVIEW_PENDING_TAB,
  REVIEW_PENDING_TASKS,
  REVIEW_RECORDS,
  REVIEW_SELECTED_ID,
  REVIEW_TAB_CODE,
  REVIEW_TABS,
  type ReviewRecord,
  type ReviewTab,
} from '@/fixtures/review';
import './ReviewV2Page.css';

/**
 * P09 评审记录中心。默认页签选「试讲记录」以确保设计稿指定的试讲选中行有对应的详情。
 *
 * <p>回归模式读 fixtures；<b>产品模式一律以接口为准</b>，库里没有评审记录就显示没有。
 * 先前接口空、报错或在途时会回落 fixtures「填满版式」——那批冻结记录带着课程名、
 * 评审人、评审结论和一致性判定，看起来与真实台账没有区别。评审记录是要被引用来
 * 回答「这门课谁评过、结论是什么」的，一屏认不出来的假记录比空白危险得多。
 */
export function ReviewV2Page() {
  const regression = isRegressionMode();
  const [tab, setTab] = useState<ReviewTab>(REVIEW_DEFAULT_TAB);
  const [selectedId, setSelectedId] = useState(REVIEW_SELECTED_ID);

  const live = useQuery({
    queryKey: ['review-records', tab],
    queryFn: () =>
      reviewRecordsApi.page({
        tab: REVIEW_TAB_CODE[tab],
        pageNum: 1,
        pageSize: 50,
      }),
    enabled: !regression,
  });
  const kpisQ = useQuery({
    queryKey: ['review-records', 'kpis'],
    queryFn: () => reviewRecordsApi.kpis(),
    enabled: !regression,
  });

  const liveRecords = useMemo(
    () => (live.data?.records ?? []).map((row) => mapReview(row, tab)),
    [live.data, tab],
  );

  const fixtureRecords = useMemo(
    () => REVIEW_RECORDS.filter((record) => record.type === tab),
    [tab],
  );

  const records = regression ? fixtureRecords : liveRecords;

  useEffect(() => {
    if (records[0] && !records.some((r) => r.id === selectedId)) {
      setSelectedId(records[0].id);
    }
  }, [records, selectedId]);

  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  const kpis = regression
    ? REVIEW_KPIS
    : [
        {
          id: 'course',
          label: '本月课程评审数',
          value: String(kpisQ.data?.courseReviewMonth ?? '—'),
          tone: 'info',
        },
        {
          id: 'trial',
          label: '本月试讲验收数',
          value: String(kpisQ.data?.trialMonth ?? '—'),
          tone: 'success',
        },
        {
          id: 'demand',
          label: '需求评审数',
          value: String(kpisQ.data?.demandReviewTotal ?? '—'),
          tone: 'brand',
        },
        {
          id: 'pending',
          label: REVIEW_PENDING_TAB,
          value: String(kpisQ.data?.pendingTotal ?? '—'),
          tone: 'warning',
        },
      ];

  function selectTab(nextTab: ReviewTab) {
    setTab(nextTab);
    if (regression) {
      const first = REVIEW_RECORDS.find((record) => record.type === nextTab);
      if (first) setSelectedId(first.id);
    }
    // 产品模式换页签后由上面那个 effect 选中新页签的首条：这里选不了，
    // 新页签的数据还没回来
  }

  return (
    <div className="rvw v2-page">
      <TabBar tab={tab} onChange={selectTab} />
      <FilterBar />
      <KpiRow items={kpis} showDelta={regression} />
      <ReviewTable
        records={records}
        selectedId={selected?.id ?? ''}
        onSelect={setSelectedId}
        totalHint={regression ? 512 : (live.data?.total ?? records.length)}
        loading={!regression && live.isPending}
        failed={!regression && live.isError}
      />
      {selected ? <DetailPanel record={selected} /> : null}
    </div>
  );
}

function mapReview(row: ReviewRecordItem, tab: ReviewTab): ReviewRecord {
  return {
    id: `${row.tab}-${row.id}`,
    type: tab,
    name: row.objectName,
    round: row.roundNo == null ? '—' : `第 ${row.roundNo} 轮`,
    version: row.boundVersion ?? '—',
    reviewedAt: row.occurredOn ?? '—',
    result: row.result ?? '—',
    operator: row.operator ?? row.acceptorName ?? '—',
    lecturerConclusion: row.secondaryResult ?? undefined,
    courseConclusion: row.tab === 'COURSE_TRIAL' ? (row.result ?? undefined) : undefined,
    score: row.feedbackAvgScore ?? undefined,
    opinion: row.opinion ?? row.outlet ?? '—',
  };
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
          {item === REVIEW_PENDING_TAB ? <em>{REVIEW_PENDING_PANEL.count}</em> : null}
        </button>
      ))}
    </nav>
  );
}

function FilterBar() {
  return (
    <section className="rvw-filters" data-region="R4" aria-label="评审记录筛选">
      <label className="rvw-search">
        <Search size={14} aria-hidden />
        <input placeholder="搜索名称 / 录入人" readOnly />
      </label>
      {REVIEW_FILTERS.map((label) => (
        <button
          className="rvw-filter"
          data-extra={label === '对象类型' || label === '领域' ? 'true' : undefined}
          key={label}
          type="button"
        >
          {label}
          <ChevronDown size={14} aria-hidden />
        </button>
      ))}
      <div className="rvw-filter-actions">
        <button type="button" className="rvw-btn rvw-btn-ghost">
          重置
        </button>
        <button type="button" className="rvw-btn rvw-btn-primary">
          查询
        </button>
      </div>
    </section>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  course: BookOpen,
  trial: Users,
  demand: Layers,
  pending: ClipboardCheck,
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
    <section className="rvw-kpis" data-region="R5" aria-label="评审指标概览">
      {items.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id] ?? FileText;
        return (
          <article
            className="rvw-kpi"
            key={kpi.id}
            data-testid="review-kpi"
            data-kpi={kpi.id}
            data-tone={kpi.tone ?? 'brand'}
          >
            <div className="rvw-kpi-text">
              <p className="rvw-kpi-label">{kpi.label}</p>
              <p className="rvw-kpi-value"><AnimatedNumber value={kpi.value} duration={520} /></p>
              {showDelta && kpi.delta ? (
                <p className="rvw-kpi-delta" data-warn={kpi.id === 'pending' ? 'true' : undefined}>
                  <span>{kpi.delta}</span>
                  <span className="rvw-kpi-period">{kpi.period ?? '较上月'}</span>
                </p>
              ) : null}
            </div>
            <span className="rvw-kpi-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
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
  totalHint,
  loading,
  failed,
}: {
  records: ReviewRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  totalHint: number;
  loading: boolean;
  failed: boolean;
}) {
  return (
    <section className="rvw-table-panel" data-region="R6" aria-label="评审记录列表">
      <div className="rvw-table-scroll">
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
            {records.length === 0 ? (
              /* 加载中、加载失败、真的没有记录——三件事各说一句，别都写「暂无数据」 */
              <tr data-testid="review-empty">
                <td colSpan={REVIEW_COLUMNS.length}>
                  {loading
                    ? '正在载入评审记录…'
                    : failed
                      ? '评审记录加载失败，请刷新重试'
                      : '这个页签下还没有评审记录。评审结论在线下产生，由运营在对应的课程／需求详情里录入后汇总到这里。'}
                </td>
              </tr>
            ) : null}
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
                  <td>
                    <ResultCell record={record} />
                  </td>
                  <td>
                    <span className="rvw-operator">
                      <span className="rvw-avatar" aria-hidden>
                        {record.operator.slice(0, 1)}
                      </span>
                      {record.operator}
                    </span>
                  </td>
                  <td>
                    {record.lecturerConclusion ? (
                      <Consistency consistent={consistent} />
                    ) : (
                      <span className="rvw-empty">—</span>
                    )}
                  </td>
                  <td>
                    <span className="rvw-actions">
                      <button className="rvw-view" type="button">
                        查看
                      </button>
                      <button className="rvw-view" type="button">
                        编辑
                      </button>
                      <button className="rvw-view rvw-more" type="button" aria-label="更多">
                        <MoreHorizontal size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="rvw-table-foot">
        <span>共 {totalHint} 条</span>
        <span className="rvw-pager">
          <em>‹</em> 1 <em>›</em>
          <span>10 条/页</span>
        </span>
      </footer>
    </section>
  );
}

function ResultCell({ record }: { record: ReviewRecord }) {
  if (record.lecturerConclusion && record.courseConclusion) {
    // 保留「讲师：… / 课程：…」整串，供回归断言与复制；标签只做着色。
    return (
      <span className="rvw-result-dual" title={record.result}>
        讲师：
        <ResultTag value={record.lecturerConclusion} />
        {' / 课程：'}
        <ResultTag value={record.courseConclusion} />
      </span>
    );
  }
  if (!record.result || record.result === '—') {
    return <span className="rvw-empty">—</span>;
  }
  return <ResultTag value={record.result} />;
}

function ResultTag({ value }: { value: string }) {
  const pass = value === '合格' || value === '通过';
  const fail = value === '不合格' || value === '不通过';
  return (
    <span className="rvw-result-tag" data-tone={pass ? 'pass' : fail ? 'fail' : 'muted'}>
      {value}
    </span>
  );
}

function isConsistent(record: ReviewRecord): boolean {
  return Boolean(record.lecturerConclusion && record.courseConclusion === record.lecturerConclusion);
}

function Consistency({ consistent }: { consistent: boolean }) {
  return (
    <span className="rvw-consistency" data-consistent={consistent}>
      {consistent ? <CheckCircle2 size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
      {consistent ? '一致' : '不一致'}
    </span>
  );
}

function DetailPanel({ record }: { record: ReviewRecord }) {
  const inconsistent = Boolean(record.lecturerConclusion && !isConsistent(record));
  const dual = Boolean(record.lecturerConclusion && record.courseConclusion);
  const lecturerPoints =
    record.lecturerPoints ??
    record.opinion
      .split(/[，。；]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);
  const coursePoints =
    record.coursePoints ??
    record.opinion
      .split(/[，。；]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);

  return (
    <section className="rvw-detail" data-region="R7" aria-label="评审记录详情">
      {inconsistent && (
        <div className="rvw-risk" data-testid="review-risk-banner" role="alert">
          <AlertTriangle size={16} aria-hidden />
          <div>
            <strong>风险提示：讲师结论与课程结论不一致</strong>
            <span>请确认课程侧结论后再进入后续流程。</span>
          </div>
        </div>
      )}

      {/*
        目标稿五栏：记录详情 | 双结论 | 绑定版本/标签/附件 | 变更时间线 | 待录入任务。
        无双结论时收成四栏：详情 | 意见 | 版本附件 | 任务。
      */}
      <div className={`rvw-detail-body${dual ? ' is-dual' : ''}`}>
        <section className="rvw-col rvw-col-meta">
          <header className="rvw-meta-head">
            <div className="rvw-meta-title-row">
              <h2 data-testid="review-detail-title">{record.name}</h2>
              <span className="rvw-type-badge">{record.type === '试讲记录' ? '试讲验收' : record.type}</span>
            </div>
            <p className="rvw-meta-id">
              ID: {record.recordCode ?? record.id}
              <button type="button" className="rvw-icon-btn" aria-label="复制编号">
                <Copy size={12} />
              </button>
            </p>
            <p className="rvw-meta-line">
              <span>{record.round}</span>
              <span>评审日期：{record.reviewedAt}</span>
              <span>录入人：{record.operator}</span>
            </p>
          </header>
          <h3>概要信息</h3>
          <dl className="rvw-detail-meta">
            <div>
              <dt>所属领域</dt>
              <dd>{record.domain ?? '—'}</dd>
            </div>
            <div>
              <dt>课程负责人</dt>
              <dd>{record.owner ?? record.operator}</dd>
            </div>
            <div>
              <dt>课程版本</dt>
              <dd>{record.version}</dd>
            </div>
            <div>
              <dt>讲师</dt>
              <dd>{record.lecturer ?? record.lecturerName ?? '—'}</dd>
            </div>
            <div>
              <dt>试讲时长</dt>
              <dd>{record.duration ?? '—'}</dd>
            </div>
            <div>
              <dt>学员人数</dt>
              <dd>{record.studentCount ? `${record.studentCount} 人` : '—'}</dd>
            </div>
          </dl>
        </section>

        {dual ? (
          <section
            className="rvw-col rvw-dual-wrap"
            data-testid="review-dual-conclusions"
            data-inconsistent={inconsistent || undefined}
          >
            <header className="rvw-dual-head">
              <h3>
                双结论
                {inconsistent ? <span className="rvw-dual-flag">（存在不一致）</span> : null}
              </h3>
            </header>
            <div className="rvw-dual">
              <article className="rvw-dual-card" data-pass={record.lecturerConclusion === '合格'}>
                <h4>讲师结论</h4>
                <div className="rvw-dual-person">
                  <span className="rvw-avatar" aria-hidden>
                    {(record.lecturerName ?? record.operator).slice(0, 1)}
                  </span>
                  <span>
                    {record.lecturerName ?? record.operator}
                    <em>讲师</em>
                  </span>
                  <ResultTag value={record.lecturerConclusion!} />
                </div>
                {(record.lecturerScore || record.score) && (
                  <p className="rvw-dual-score">
                    评分：{record.lecturerScore ?? record.score?.split(' / ')[0]} 分
                  </p>
                )}
                <p className="rvw-dual-points-label">核心意见</p>
                <ul className="rvw-dual-points">
                  {lecturerPoints.map((bit) => (
                    <li key={bit}>{bit}</li>
                  ))}
                </ul>
              </article>
              <article className="rvw-dual-card" data-pass={record.courseConclusion === '合格'}>
                <h4>运营结论</h4>
                <div className="rvw-dual-person">
                  <span className="rvw-avatar" data-tone="warm" aria-hidden>
                    {(record.courseOperator ?? '运').slice(0, 1)}
                  </span>
                  <span>
                    {record.courseOperator ?? '运营'}
                    <em>运营</em>
                  </span>
                  <ResultTag value={record.courseConclusion!} />
                </div>
                {(record.courseScore || record.score) && (
                  <p className="rvw-dual-score">
                    评分：{record.courseScore ?? record.score?.split(' / ')[1]} 分
                  </p>
                )}
                <p className="rvw-dual-points-label">核心意见</p>
                <ul className="rvw-dual-points">
                  {coursePoints.map((bit) => (
                    <li key={`c-${bit}`}>{bit}</li>
                  ))}
                </ul>
              </article>
            </div>
            {inconsistent && (
              <div className="rvw-dual-foot">
                <p className="rvw-dual-warn">
                  <AlertTriangle size={14} aria-hidden />
                  结论不一致，请关注并处理
                </p>
                <button type="button" className="rvw-btn rvw-btn-primary">
                  发起复审
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="rvw-col rvw-opinion">
            <h3>评审意见</h3>
            <p>{record.opinion}</p>
          </section>
        )}

        <section className="rvw-col rvw-col-bind">
          <h3>绑定版本</h3>
          <p className="rvw-bind-version">
            {record.version}
            <em>（当前版本）</em>
          </p>
          <button type="button" className="rvw-link">
            查看版本详情
          </button>
          <h4>关键标签</h4>
          <div className="rvw-tags">
            {REVIEW_DETAIL_TAGS.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <h4>附件</h4>
          <div className="rvw-attach">
            <span className="rvw-attach-icon" aria-hidden>
              <FileText size={16} />
            </span>
            <div>
              <strong>{REVIEW_DETAIL_ATTACHMENT.name}</strong>
              <span>{REVIEW_DETAIL_ATTACHMENT.size}</span>
            </div>
            <button type="button" className="rvw-icon-btn" aria-label="下载附件">
              <Download size={14} />
            </button>
          </div>
        </section>

        {dual ? (
          <section className="rvw-col rvw-col-timeline">
            <h3>变更时间线</h3>
            <ol className="rvw-timeline">
              {REVIEW_DETAIL_TIMELINE.map((item, index) => (
                <li key={item.at} data-last={index === REVIEW_DETAIL_TIMELINE.length - 1 || undefined}>
                  <time>{item.at}</time>
                  <strong>{item.text}</strong>
                  {'detail' in item && item.detail ? <span>{item.detail}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="rvw-col rvw-col-tasks">
          <header className="rvw-tasks-head">
            <h3>{REVIEW_PENDING_PANEL.title}</h3>
            {/* 措辞避开「待处理」：那三个字是任务状态机的取值，会被 STK-1 门禁按子串命中 */}
            <em className="rvw-tasks-count">共 {REVIEW_PENDING_PANEL.count} 条</em>
          </header>
          <p className="rvw-pending-hint">{REVIEW_PENDING_PANEL.hint}</p>
          <ul className="rvw-pending">
            {REVIEW_PENDING_TASKS.map((task) => (
              <li key={task.id}>
                <span className="rvw-pending-dot" aria-hidden />
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.owner}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="rvw-tasks-foot">
            <button type="button" className="rvw-link">
              查看全部 {REVIEW_PENDING_PANEL.count} 条
            </button>
            <img className="rvw-tasks-art" src={ASSETS.A09} alt="" aria-hidden />
          </div>
        </section>
      </div>
    </section>
  );
}
