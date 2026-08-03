import { useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileInput,
  FolderOpen,
  Plus,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { Chart } from '@/shared/ui/v2/Chart';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import {
  CALENDAR_SESSIONS,
  PLAN_LIST_COLUMNS,
  PLAN_LIST_ROWS,
  PLAN_LIST_TOTAL,
  TODAY_REMINDERS,
  TRAINING_CALENDAR,
  TRAINING_CTA,
  TRAINING_DEFAULT_VIEW,
  TRAINING_DETAIL,
  TRAINING_DETAIL_ACTIVE_TAB,
  TRAINING_DETAIL_TABS,
  TRAINING_FILTERS,
  TRAINING_KPIS,
  TRAINING_SELECTED_SESSION_ID,
  TRAINING_VIEWS,
  type CalendarSession,
  type SessionState,
  type TrainingView,
} from '@/fixtures/training';
import './TrainingV2Page.css';

/**
 * P05 培训运营地图（《设计文档 V2.0》第 9 章）。
 *
 * <p>五个区域各带 {@code data-region}，编号与文档 9「区域坐标」表一一对应。
 * 这一页与 P04 同构：KPI 独占顶带，下方左栏（工具条／月历／计划列表）与右侧详情同起同止。
 *
 * <p>字段口径与 V2.0 表面文字的出入逐条写在 {@link file://./../../fixtures/training.ts} 头注里。
 * 核心三条：场次状态只有四值合法枚举、导入结果三词对齐 14.4、培训形式不用「线上直播」。
 */
export function TrainingV2Page() {
  const [view, setView] = useState<TrainingView>(TRAINING_DEFAULT_VIEW);
  const [selectedDay, setSelectedDay] = useState<number>(TRAINING_CALENDAR.selectedDay);
  const [selectedId, setSelectedId] = useState(TRAINING_SELECTED_SESSION_ID);

  return (
    <div className="trn v2-page">
      <KpiRow />
      <Toolbar view={view} onViewChange={setView} />

      <div className="trn-main">
        <div className="trn-left">
          <CalendarPanel
            view={view}
            selectedDay={selectedDay}
            selectedId={selectedId}
            onSelectDay={setSelectedDay}
            onSelectSession={setSelectedId}
          />
          <PlanListPanel selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <DetailPanel selectedId={selectedId} />
      </div>
    </div>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  CalendarDays,
  Briefcase,
  Video,
  Users,
  FileInput,
  FolderOpen,
};

/** R3 六张 KPI：273,70,1289,111。正文宽 1289，这一行铺满 */
function KpiRow() {
  return (
    <section className="trn-kpis" data-region="R3" aria-label="培训指标概览">
      {TRAINING_KPIS.map((kpi) => {
        const Icon = KPI_ICONS[kpi.icon]!;
        return (
          <article
            className="trn-kpi"
            key={kpi.id}
            data-testid="training-kpi"
            data-kpi={kpi.id}
            data-down={'down' in kpi && kpi.down ? 'true' : 'false'}
          >
            <div className="trn-kpi-text">
              <p className="trn-kpi-label">{kpi.label}</p>
              <p className="trn-kpi-value">{kpi.value}</p>
              <p className="trn-kpi-delta">
                <span>{kpi.delta}</span>
                <span className="trn-kpi-period">{kpi.period}</span>
              </p>
            </div>
            <span className="trn-kpi-plate" aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
          </article>
        );
      })}
    </section>
  );
}

/** R4 日历工具条：273,196,1289,48 */
function Toolbar({
  view,
  onViewChange,
}: {
  view: TrainingView;
  onViewChange: (next: TrainingView) => void;
}) {
  return (
    <section className="trn-toolbar" data-region="R4" aria-label="日历工具条">
      <div className="trn-view-switch" role="tablist" aria-label="日历视图">
        {TRAINING_VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            className="trn-view-btn"
            role="tab"
            data-testid="calendar-view"
            data-active={item === view}
            aria-selected={item === view}
            onClick={() => onViewChange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="trn-nav">
        <button type="button" className="trn-nav-btn" aria-label="上一时段">
          <ChevronLeft size={14} />
        </button>
        <span className="trn-nav-label" data-testid="calendar-month">
          {TRAINING_CALENDAR.year}年{TRAINING_CALENDAR.month}月
        </span>
        <button type="button" className="trn-nav-btn" aria-label="下一时段">
          <ChevronRight size={14} />
        </button>
        <button type="button" className="trn-today">
          今天
        </button>
      </div>

      <label className="trn-search">
        <Search size={14} aria-hidden />
        <input type="search" placeholder="搜索计划 / 场次" readOnly />
      </label>

      {TRAINING_FILTERS.map((filter) => (
        <button key={filter.id} type="button" className="trn-select" data-testid="training-filter">
          <span className="trn-select-placeholder">{filter.label}</span>
          <ChevronDown size={12} aria-hidden />
        </button>
      ))}

      <button type="button" className="trn-create">
        <Plus size={14} aria-hidden />
        新建培训计划
      </button>
      <button type="button" className="trn-import">
        导入签到
      </button>
    </section>
  );
}

/** R5 培训月历：273,257,814,455 */
function CalendarPanel({
  view,
  selectedDay,
  selectedId,
  onSelectDay,
  onSelectSession,
}: {
  view: TrainingView;
  selectedDay: number;
  selectedId: string;
  onSelectDay: (day: number) => void;
  onSelectSession: (id: string) => void;
}) {
  return (
    <section className="panel trn-calendar" data-region="R5" aria-label="培训月历">
      {view === '月' && (
        <MonthGrid
          selectedDay={selectedDay}
          selectedId={selectedId}
          onSelectDay={onSelectDay}
          onSelectSession={onSelectSession}
        />
      )}
      {view === '周' && (
        <WeekGrid
          selectedDay={selectedDay}
          selectedId={selectedId}
          onSelectDay={onSelectDay}
          onSelectSession={onSelectSession}
        />
      )}
      {view === '日' && (
        <DayGrid
          selectedDay={selectedDay}
          selectedId={selectedId}
          onSelectSession={onSelectSession}
        />
      )}
    </section>
  );
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * 2024 年 5 月的月历格子。
 *
 * <p>月份取自 fixture：文档 0.3 禁止用今天。5 月 1 日是周三，表头从周一起，
 * 前两格是上月 29／30（文档点名「以弱化色显示」）。
 */
function MonthGrid({
  selectedDay,
  selectedId,
  onSelectDay,
  onSelectSession,
}: {
  selectedDay: number;
  selectedId: string;
  onSelectDay: (day: number) => void;
  onSelectSession: (id: string) => void;
}) {
  const { year, month, prevMonthTail } = TRAINING_CALENDAR;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarSession[]>();
    CALENDAR_SESSIONS.forEach((session) => {
      const list = map.get(session.day) ?? [];
      list.push(session);
      map.set(session.day, list);
    });
    return map;
  }, []);

  return (
    <div className="trn-month" role="grid" aria-label={`${year} 年 ${month} 月排期`}>
      <div className="trn-month-head">
        {WEEKDAYS.map((day) => (
          <span className="trn-weekday" key={day}>
            {day}
          </span>
        ))}
      </div>

      <div className="trn-month-body">
        {Array.from({ length: firstWeekday }, (_, index) => (
          <div className="trn-cell trn-cell-muted" key={`pad-${index}`} aria-hidden>
            <span className="trn-cell-day">{prevMonthTail[index] ?? ''}</span>
          </div>
        ))}

        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const sessions = byDay.get(day) ?? [];
          const visible = sessions.slice(0, 2);
          const more = sessions.length - visible.length;

          return (
            <button
              type="button"
              className="trn-cell"
              key={day}
              data-testid="calendar-day"
              data-selected={day === selectedDay}
              data-day={day}
              onClick={() => onSelectDay(day)}
            >
              <span className="trn-cell-day">{day}</span>
              {visible.map((session) => (
                <SessionChip
                  key={session.id}
                  session={session}
                  selected={session.id === selectedId}
                  onSelect={onSelectSession}
                />
              ))}
              {more > 0 && <span className="trn-cell-more">+{more}场</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 周视图：选中日所在那一周的七天。
 *
 * <p>用同一批冻结场次按日切片——验收句要求「切换必须重排」，不是换个高亮还停在月视图。
 */
function WeekGrid({
  selectedDay,
  selectedId,
  onSelectDay,
  onSelectSession,
}: {
  selectedDay: number;
  selectedId: string;
  onSelectDay: (day: number) => void;
  onSelectSession: (id: string) => void;
}) {
  const { year, month } = TRAINING_CALENDAR;
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedOffset = firstWeekday + selectedDay - 1;
  const weekStartOffset = selectedOffset - (selectedOffset % 7);

  const days = Array.from({ length: 7 }, (_, index) => {
    const absolute = weekStartOffset + index;
    const day = absolute - firstWeekday + 1;
    const inMonth = day >= 1 && day <= new Date(year, month, 0).getDate();
    return { day: inMonth ? day : null, weekday: WEEKDAYS[index]! };
  });

  return (
    <div className="trn-week" data-testid="week-grid" role="grid" aria-label="周视图">
      {days.map(({ day, weekday }) => {
        const sessions = day == null ? [] : CALENDAR_SESSIONS.filter((item) => item.day === day);
        return (
          <div className="trn-week-col" key={weekday}>
            <button
              type="button"
              className="trn-week-head"
              data-selected={day === selectedDay}
              disabled={day == null}
              onClick={() => day != null && onSelectDay(day)}
            >
              <span>{weekday}</span>
              <span className="trn-week-day">{day ?? '—'}</span>
            </button>
            <div className="trn-week-list">
              {sessions.map((session) => (
                <SessionChip
                  key={session.id}
                  session={session}
                  selected={session.id === selectedId}
                  onSelect={onSelectSession}
                  expanded
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 日视图：只铺选中那天的场次，按开始时间排序 */
function DayGrid({
  selectedDay,
  selectedId,
  onSelectSession,
}: {
  selectedDay: number;
  selectedId: string;
  onSelectSession: (id: string) => void;
}) {
  const sessions = CALENDAR_SESSIONS.filter((item) => item.day === selectedDay).sort((a, b) =>
    a.time.localeCompare(b.time),
  );

  return (
    <div className="trn-day" data-testid="day-grid" aria-label={`${selectedDay} 日排期`}>
      <p className="trn-day-title">
        {TRAINING_CALENDAR.year}-{String(TRAINING_CALENDAR.month).padStart(2, '0')}-
        {String(selectedDay).padStart(2, '0')} · 共 {sessions.length} 场
      </p>
      <ul className="trn-day-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              className="trn-day-row"
              data-testid="day-session"
              data-selected={session.id === selectedId}
              onClick={() => onSelectSession(session.id)}
            >
              <span className="trn-day-time">{session.time}</span>
              <span className="trn-day-title-text">{session.title}</span>
              <span className="trn-day-meta">{session.meta}</span>
              <StateTag state={session.state} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionChip({
  session,
  selected,
  onSelect,
  expanded = false,
}: {
  session: CalendarSession;
  selected: boolean;
  onSelect: (id: string) => void;
  expanded?: boolean;
}) {
  return (
    <span
      className="trn-chip"
      data-testid="calendar-session"
      data-state={session.state}
      data-selected={selected}
      data-expanded={expanded}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(session.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onSelect(session.id);
        }
      }}
    >
      <span className="trn-chip-time">{session.time}</span>
      <span className="trn-chip-title">{session.title}</span>
      {expanded && <span className="trn-chip-meta">{session.meta}</span>}
      <StateTag state={session.state} />
    </span>
  );
}

function StateTag({ state }: { state: SessionState }) {
  return (
    <span className="trn-state" data-state={state} data-testid="session-state">
      {state}
    </span>
  );
}

/** R6 培训计划列表：273,728,814,242。八列合计 814，左右不留内边距 */
function PlanListPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel trn-list" data-region="R6" aria-label="培训计划列表">
      <header className="panel-head trn-list-head">
        <h2 className="panel-title">培训计划列表</h2>
        <span className="panel-count" data-testid="plan-list-total">
          {PLAN_LIST_TOTAL}
        </span>
      </header>

      <table className="trn-table" data-testid="plan-list-table">
        <colgroup>
          {PLAN_LIST_COLUMNS.map((column) => (
            <col key={column.id} data-col={column.id} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {PLAN_LIST_COLUMNS.map((column) => (
              <th key={column.id} data-col={column.id}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_LIST_ROWS.map((row) => (
            <tr
              key={row.id}
              data-testid="plan-row"
              data-selected={row.id === selectedId}
              onClick={() => onSelect(row.id)}
            >
              <td data-col="planName" title={row.planName}>
                {row.planName}
              </td>
              <td data-col="session">{row.sessionLabel}</td>
              <td data-col="course" title={row.course}>
                {row.course}
              </td>
              <td data-col="lecturer">{row.lecturer}</td>
              <td data-col="date">{row.date}</td>
              <td data-col="attendance">
                <span className="trn-attend">
                  <span
                    className="trn-attend-dot"
                    data-level={row.signed === row.expected ? 'full' : 'partial'}
                  />
                  {row.signed}/{row.expected}
                </span>
              </td>
              <td data-col="feedback">{row.feedback ?? '—'}</td>
              <td data-col="action">
                <button type="button" className="trn-link">
                  详情
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="trn-pager" data-testid="plan-pager">
        <span>
          1-{PLAN_LIST_ROWS.length} / 共 {PLAN_LIST_TOTAL} 条
        </span>
        <div className="trn-pager-pages">
          <button type="button" className="trn-pager-page" data-current="true">
            1
          </button>
          <button type="button" className="trn-pager-page">
            2
          </button>
          <button type="button" className="trn-pager-page">
            3
          </button>
        </div>
      </footer>
    </section>
  );
}

/** R7 培训详情：1102,257,450,669 */
function DetailPanel({ selectedId }: { selectedId: string }) {
  /*
   * 详情主体始终用默认场次的冻结内容——文档只冻结了这一场。
   * selectedId 只驱动标题区的选中态与列表高亮；换一场不改圆环数字，
   * 避免「点了另一行圆环还是 57%」被读成数据联动 bug。真数据阶段再接接口。
   */
  void selectedId;

  const ringOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: 'pie',
          radius: ['62%', '82%'],
          center: ['50%', '50%'],
          silent: true,
          label: { show: false },
          data: [
            { value: TRAINING_DETAIL.signed, name: '已签到', itemStyle: { color: colorV2.brandAction } },
            {
              value: TRAINING_DETAIL.unsigned,
              name: '未签到',
              itemStyle: { color: colorV2.borderDefault },
            },
          ],
        },
      ],
    }),
    [],
  );

  return (
    <section className="panel trn-detail" data-region="R7" aria-label="培训详情">
      <header className="trn-detail-head">
        <div className="trn-detail-titles">
          <h2 className="trn-detail-name" data-testid="detail-title">
            {TRAINING_DETAIL.title}
          </h2>
          <StateTag state={TRAINING_DETAIL.state} />
        </div>
        <button type="button" className="trn-detail-close" aria-label="关闭详情">
          <X size={14} />
        </button>
      </header>

      <nav className="trn-tabs" aria-label="培训详情页签">
        {TRAINING_DETAIL_TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className="trn-tab"
            data-testid="training-tab"
            data-active={index === TRAINING_DETAIL_ACTIVE_TAB}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="trn-detail-body">
        <div className="trn-detail-grid">
          <dl className="trn-fields">
            {TRAINING_DETAIL.fields.map((field) => (
              <div className="trn-field" key={field.label} data-testid="training-field">
                <dt>{field.label}</dt>
                <dd title={field.value}>{field.value}</dd>
              </div>
            ))}
          </dl>

          <div className="trn-ring" data-testid="attendance-ring">
            {/*
             * 百分比用 HTML 叠在圆环正中，不用 ECharts graphic。
             * graphic 文本在 SVG 里，Playwright 的 toContainText 读不到——
             * 断言「57%」会超时，而肉眼看着圆环是有字的。
             */}
            <div className="trn-ring-chart">
              <Chart option={ringOption} height={132} ariaLabel="签到完成率" />
              <div className="trn-ring-center">
                <span className="trn-ring-value">{TRAINING_DETAIL.attendanceRate}%</span>
                <span className="trn-ring-label">签到完成率</span>
              </div>
            </div>
            <p className="trn-ring-caption">
              已签到 {TRAINING_DETAIL.signed} · 应签到 {TRAINING_DETAIL.expected}
            </p>
          </div>
        </div>

        <div className="trn-import-result" data-testid="import-result">
          <p className="trn-block-title">导入结果</p>
          <ul>
            {TRAINING_DETAIL.importResult.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="trn-reminders" data-testid="today-reminders">
          <p className="trn-block-title">今日提醒</p>
          <ol>
            {TODAY_REMINDERS.map((item) => (
              <li key={`${item.time}-${item.title}`}>
                <span className="trn-reminder-time">{item.time}</span>
                <span className="trn-reminder-title">{item.title}</span>
                <StateTag state={item.state} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      <footer className="trn-cta" data-testid="training-cta">
        <img className="trn-cta-art" src={ASSETS.A12} alt="" aria-hidden />
        <div className="trn-cta-text">
          <p className="trn-cta-title">{TRAINING_CTA.title}</p>
          <p className="trn-cta-body">{TRAINING_CTA.body}</p>
          <button type="button" className="trn-cta-action">
            <Plus size={14} aria-hidden />
            {TRAINING_CTA.action}
          </button>
        </div>
      </footer>
    </section>
  );
}
