import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileInput,
  FolderOpen,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Star,
  Users,
  Video,
  X,
} from 'lucide-react';
import { isRegressionMode } from '@/app/regressionMode';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { Chart } from '@/shared/ui/v2/Chart';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import {
  ATTENDANCE_LABELS,
  CALENDAR_SESSIONS,
  PLAN_LIST_COLUMNS,
  PLAN_LIST_ROWS,
  PLAN_LIST_TOTAL,
  TODAY_REMINDERS,
  TRAINING_CTA,
  TRAINING_DEFAULT_VIEW,
  TRAINING_DETAIL,
  TRAINING_DETAIL_ACTIVE_TAB,
  TRAINING_DETAIL_TABS,
  TRAINING_FILTERS,
  TRAINING_KPIS,
  TRAINING_SELECTED_SESSION_ID,
  TRAINING_VIEWS,
  resolveTrainingCalendar,
  type CalendarSession,
  type SessionState,
  type TrainingView,
} from '@/fixtures/training';
import { currentDateText } from '@/fixtures/fixtureClock';
import './TrainingV2Page.css';

/**
 * P05 培训运营地图（《设计文档 V2.0》第 9 章）。
 *
 * <p>五个区域各带 {@code data-region}，编号与文档 9「区域坐标」表一一对应。
 * 这一页与 P04 同构：KPI 独占顶带，下方左栏（工具条／月历／计划列表）与右侧详情同起同止。
 *
 * <p>字段口径与 V2.0 表面文字的出入逐条写在 {@link file://./../../fixtures/training.ts} 头注里。
 * 核心三条：场次状态只有四值合法枚举、导入结果三词对齐 14.4、培训形式不用「线上直播」。
 *
 * <p>产品模式的月历学总裁日程看板：单行场次条、周末底、格子至少能放下数条；
 * 全屏收起 KPI／计划表／详情，把高度还给格子（单格 ≥5 条）。回归模式几何不动。
 */
/** 回归模式锁 2 条，避免撑破 455px 格子。产品常态 3 条；全屏按日程看板放到 5 条 */
const REGRESSION_MONTH_CHIPS = 2;
const PRODUCT_MONTH_CHIPS = 3;
const FULLSCREEN_MONTH_CHIPS = 5;

export function TrainingV2Page() {
  const regression = isRegressionMode();
  /* 月历锚点只在挂载时取一次：翻月后重算会把用户翻到的月份弹回当月 */
  const anchor = useMemo(() => resolveTrainingCalendar(), []);
  const [view, setView] = useState<TrainingView>(TRAINING_DEFAULT_VIEW);
  const [year, setYear] = useState(anchor.year);
  const [month, setMonth] = useState(anchor.month);
  const [selectedDay, setSelectedDay] = useState(anchor.selectedDay);
  const [selectedId, setSelectedId] = useState(TRAINING_SELECTED_SESSION_ID);
  const [fullscreen, setFullscreen] = useState(false);

  const calendarFullscreen = fullscreen && !regression;
  const monthChipLimit = regression
    ? REGRESSION_MONTH_CHIPS
    : calendarFullscreen
      ? FULLSCREEN_MONTH_CHIPS
      : PRODUCT_MONTH_CHIPS;

  /* 「今天」只在翻回当月时才有格子可标 */
  const today = useMemo(() => {
    const current = resolveTrainingCalendar();
    return current.year === year && current.month === month ? current.today : null;
  }, [year, month]);

  useEffect(() => {
    if (!calendarFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calendarFullscreen]);

  const shiftByDays = (days: number) => {
    const next = new Date(year, month - 1, selectedDay + days);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDay(next.getDate());
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDay(1);
  };

  const shiftCursor = (delta: number) => {
    if (view === '日') {
      shiftByDays(delta);
      return;
    }
    if (view === '周') {
      shiftByDays(delta * 7);
      return;
    }
    shiftMonth(delta);
  };

  const backToToday = () => {
    const current = resolveTrainingCalendar();
    setYear(current.year);
    setMonth(current.month);
    setSelectedDay(current.today);
  };

  return (
    <div className="trn v2-page" data-fullscreen={calendarFullscreen}>
      {!calendarFullscreen && <KpiRow />}
      <Toolbar
        view={view}
        year={year}
        month={month}
        selectedDay={selectedDay}
        fullscreen={calendarFullscreen}
        showFullscreen={!regression}
        onViewChange={setView}
        onPrev={() => shiftCursor(-1)}
        onNext={() => shiftCursor(1)}
        onToday={backToToday}
        onToggleFullscreen={() => setFullscreen((value) => !value)}
      />

      <div className="trn-main">
        <div className="trn-left">
          <CalendarPanel
            view={view}
            year={year}
            month={month}
            today={today}
            selectedDay={selectedDay}
            selectedId={selectedId}
            monthChipLimit={monthChipLimit}
            onSelectDay={setSelectedDay}
            onSelectSession={setSelectedId}
          />
          {!calendarFullscreen && <PlanListPanel selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
        {!calendarFullscreen && <DetailPanel selectedId={selectedId} />}
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

function formatWeekRange(year: number, month: number, selectedDay: number) {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedOffset = firstWeekday + selectedDay - 1;
  const weekStart = new Date(year, month - 1, selectedDay - (selectedOffset % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

function navLabel(view: TrainingView, year: number, month: number, selectedDay: number) {
  if (view === '周') return formatWeekRange(year, month, selectedDay);
  if (view === '日') {
    return `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  }
  return `${year}年${month}月`;
}

/** R4 日历工具条：273,196,1289,48 */
function Toolbar({
  view,
  year,
  month,
  selectedDay,
  fullscreen,
  showFullscreen,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onToggleFullscreen,
}: {
  view: TrainingView;
  year: number;
  month: number;
  selectedDay: number;
  fullscreen: boolean;
  showFullscreen: boolean;
  onViewChange: (next: TrainingView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleFullscreen: () => void;
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
        <button type="button" className="trn-nav-btn" aria-label="上一时段" onClick={onPrev}>
          <ChevronLeft size={14} />
        </button>
        <span className="trn-nav-label" data-testid="calendar-month" data-view={view}>
          {navLabel(view, year, month, selectedDay)}
        </span>
        <button type="button" className="trn-nav-btn" aria-label="下一时段" onClick={onNext}>
          <ChevronRight size={14} />
        </button>
        <button type="button" className="trn-today" onClick={onToday}>
          {view === '周' ? '本周' : '今天'}
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

      {showFullscreen && (
        <button
          type="button"
          className="trn-fullscreen"
          data-active={fullscreen}
          data-testid="calendar-fullscreen"
          aria-pressed={fullscreen}
          aria-label={fullscreen ? '退出全屏' : '日历全屏'}
          title={fullscreen ? '退出全屏' : '日历全屏'}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
        </button>
      )}

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
  year,
  month,
  today,
  selectedDay,
  selectedId,
  monthChipLimit,
  onSelectDay,
  onSelectSession,
}: {
  view: TrainingView;
  year: number;
  month: number;
  today: number | null;
  selectedDay: number;
  selectedId: string;
  monthChipLimit: number;
  onSelectDay: (day: number) => void;
  onSelectSession: (id: string) => void;
}) {
  return (
    <section className="panel trn-calendar" data-region="R5" aria-label="培训月历">
      {view === '月' && (
        <MonthGrid
          year={year}
          month={month}
          today={today}
          selectedDay={selectedDay}
          selectedId={selectedId}
          chipLimit={monthChipLimit}
          onSelectDay={onSelectDay}
          onSelectSession={onSelectSession}
        />
      )}
      {view === '周' && (
        <WeekGrid
          year={year}
          month={month}
          today={today}
          selectedDay={selectedDay}
          selectedId={selectedId}
          onSelectDay={onSelectDay}
          onSelectSession={onSelectSession}
        />
      )}
      {view === '日' && (
        <DayGrid
          year={year}
          month={month}
          selectedDay={selectedDay}
          selectedId={selectedId}
          onSelectSession={onSelectSession}
        />
      )}
    </section>
  );
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 上月尾巴的日号，用来填首行补白格 */
function buildPrevMonthTail(year: number, month: number, count: number) {
  const lastDayOfPrevMonth = new Date(year, month - 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => lastDayOfPrevMonth - count + 1 + index);
}

function sessionsOn(day: number, monthOffset = 0) {
  return CALENDAR_SESSIONS.filter(
    (session) => session.day === day && (session.monthOffset ?? 0) === monthOffset,
  );
}

/**
 * 当月月历格子。
 *
 * <p>行数按当月实际跨周数算（4～6 行都可能），不写死 5 行：
 * 写死会让 31 天且首日靠后的月份少掉一整行。
 * 首尾补白格用弱化色显示上月尾与下月头（文档点名）。
 */
function MonthGrid({
  year,
  month,
  today,
  selectedDay,
  selectedId,
  chipLimit,
  onSelectDay,
  onSelectSession,
}: {
  year: number;
  month: number;
  today: number | null;
  selectedDay: number;
  selectedId: string;
  chipLimit: number;
  onSelectDay: (day: number) => void;
  onSelectSession: (id: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
  const trailingCount = weekCount * 7 - firstWeekday - daysInMonth;
  const prevMonthTail = buildPrevMonthTail(year, month, firstWeekday);

  return (
    <div className="trn-month" role="grid" aria-label={`${year} 年 ${month} 月排期`}>
      <div className="trn-month-head">
        {WEEKDAYS.map((day, index) => (
          <span className="trn-weekday" key={day} data-weekend={index >= 5}>
            {day}
          </span>
        ))}
      </div>

      <div
        className="trn-month-body"
        style={{
          gridTemplateRows: `repeat(${weekCount}, minmax(${chipLimit >= FULLSCREEN_MONTH_CHIPS ? 160 : 0}px, 1fr))`,
        }}
      >
        {prevMonthTail.map((day, index) => {
          /* 上月场次按格位挂：上月天数逐月变，按日号挂会在 30／31 天月之间漂 */
          const sessions = CALENDAR_SESSIONS.filter(
            (session) =>
              (session.monthOffset ?? 0) === -1 &&
              (session.prevWeekday != null ? session.prevWeekday === index : session.day === day),
          );
          const visible = sessions.slice(0, chipLimit);
          const more = sessions.length - visible.length;

          return (
            <div
              className="trn-cell trn-cell-muted"
              key={`pad-${day}`}
              data-weekend={index >= 5}
              aria-hidden
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
            </div>
          );
        })}

        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const weekday = (firstWeekday + index) % 7;
          const sessions = sessionsOn(day, 0);
          const visible = sessions.slice(0, chipLimit);
          const more = sessions.length - visible.length;
          const isToday = today != null && day === today;

          return (
            <button
              type="button"
              className="trn-cell"
              key={day}
              data-testid="calendar-day"
              data-selected={day === selectedDay}
              data-today={isToday}
              data-weekend={weekday >= 5}
              data-day={day}
              onClick={() => onSelectDay(day)}
            >
              <span className="trn-cell-head">
                <span className="trn-cell-day">{day}</span>
                {isToday && <span className="trn-cell-badge">今</span>}
              </span>
              {visible.map((session) => (
                <SessionChip
                  key={session.id}
                  session={session}
                  selected={session.id === selectedId}
                  onSelect={onSelectSession}
                />
              ))}
              {more > 0 && (
                <span
                  className="trn-cell-more"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectDay(day);
                  }}
                >
                  +{more}场
                </span>
              )}
            </button>
          );
        })}

        {Array.from({ length: trailingCount }, (_, index) => (
          <div className="trn-cell trn-cell-muted" key={`trail-${index}`} aria-hidden>
            <span className="trn-cell-day">{index + 1}</span>
          </div>
        ))}
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
  year,
  month,
  today,
  selectedDay,
  selectedId,
  onSelectDay,
  onSelectSession,
}: {
  year: number;
  month: number;
  today: number | null;
  selectedDay: number;
  selectedId: string;
  onSelectDay: (day: number) => void;
  onSelectSession: (id: string) => void;
}) {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedOffset = firstWeekday + selectedDay - 1;
  const weekStartOffset = selectedOffset - (selectedOffset % 7);

  const days = Array.from({ length: 7 }, (_, index) => {
    const absolute = weekStartOffset + index;
    const day = absolute - firstWeekday + 1;
    const inMonth = day >= 1 && day <= new Date(year, month, 0).getDate();
    return { day: inMonth ? day : null, weekday: WEEKDAYS[index]!, weekend: index >= 5 };
  });

  return (
    <div className="trn-week" data-testid="week-grid" role="grid" aria-label="周视图">
      {days.map(({ day, weekday, weekend }) => {
        const sessions = day == null ? [] : sessionsOn(day, 0);
        return (
          <div
            className="trn-week-col"
            key={weekday}
            data-weekend={weekend}
            data-today={day != null && today === day}
            data-selected={day === selectedDay}
          >
            <button
              type="button"
              className="trn-week-head"
              data-selected={day === selectedDay}
              data-weekend={weekend}
              disabled={day == null}
              onClick={() => day != null && onSelectDay(day)}
            >
              <span>{weekday}</span>
              <span className="trn-week-day">{day ?? '—'}</span>
            </button>
            <div className="trn-week-list">
              {sessions.length === 0 ? (
                <p className="trn-week-empty">无场次</p>
              ) : (
                sessions.map((session) => (
                  <SessionChip
                    key={session.id}
                    session={session}
                    selected={session.id === selectedId}
                    onSelect={onSelectSession}
                    expanded
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 日视图：只铺选中那天的场次，按开始时间排序 */
function DayGrid({
  year,
  month,
  selectedDay,
  selectedId,
  onSelectSession,
}: {
  year: number;
  month: number;
  selectedDay: number;
  selectedId: string;
  onSelectSession: (id: string) => void;
}) {
  const sessions = sessionsOn(selectedDay, 0).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="trn-day" data-testid="day-grid" aria-label={`${selectedDay} 日排期`}>
      <p className="trn-day-title">
        {year}-{String(month).padStart(2, '0')}-{String(selectedDay).padStart(2, '0')} · 共{' '}
        {sessions.length} 场
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
      <span className="trn-chip-head">
        <span className="trn-chip-time">{session.time}</span>
        <span className="trn-chip-title">{session.title}</span>
      </span>
      <span className="trn-chip-meta">{session.meta}</span>
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
                <span className="trn-plan-name">{row.planName}</span>
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
                  <span className="trn-attend-text">
                    {row.signed === row.expected ? ATTENDANCE_LABELS.done : ATTENDANCE_LABELS.pending}{' '}
                    {row.signed}/{row.expected}
                  </span>
                </span>
              </td>
              <td data-col="feedback">
                {row.feedback == null ? (
                  '—'
                ) : (
                  <span className="trn-feedback">
                    <Star size={12} fill="#16a34a" color="#16a34a" aria-hidden />
                    {row.feedback}
                  </span>
                )}
              </td>
              <td data-col="action">
                <button type="button" className="trn-link">
                  详情
                </button>
                <button type="button" className="trn-link trn-link-more" aria-label="更多">
                  ···
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
              <Chart option={ringOption} height={112} ariaLabel="签到完成率" />
              <div className="trn-ring-center">
                <span className="trn-ring-value">{TRAINING_DETAIL.attendanceRate}%</span>
                <span className="trn-ring-label">签到完成率</span>
              </div>
            </div>
            <div className="trn-ring-stats">
              <span>
                已签到 <b>{TRAINING_DETAIL.signed}</b> 人
              </span>
              <span>
                应签到 <b>{TRAINING_DETAIL.expected}</b> 人
              </span>
            </div>
            <button type="button" className="trn-ring-link">
              查看签到详情
            </button>
          </div>
        </div>

        <div className="trn-detail-modules">
          <div className="trn-import-result" data-testid="import-result">
            <p className="trn-block-title">签到导入结果</p>
            <p className="trn-import-time">最近导入 {currentDateText('2026-08-09 13:20')}</p>
            <ul>
              {TRAINING_DETAIL.importResult.map((item) => (
                <li key={item.label}>
                  <span className="trn-import-dot" data-label={item.label} aria-hidden />
                  <span className="trn-import-label">{item.label}</span>
                  <strong>
                    {item.value}
                    <em>人</em>
                  </strong>
                </li>
              ))}
            </ul>
            <button type="button" className="trn-module-link">
              查看导入记录
            </button>
          </div>

          <div className="trn-reminders" data-testid="today-reminders">
            <p className="trn-block-title">
              今日提醒
              <span className="trn-reminder-badge" aria-label={`${TODAY_REMINDERS.length} 条提醒`}>
                <Bell size={11} aria-hidden />
                {TODAY_REMINDERS.length}
              </span>
            </p>
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
      </div>

      <footer className="trn-cta" data-testid="training-cta">
        <div className="trn-cta-text">
          <p className="trn-cta-title">{TRAINING_CTA.title}</p>
          <p className="trn-cta-body">{TRAINING_CTA.body}</p>
          <button type="button" className="trn-cta-action">
            <Plus size={14} aria-hidden />
            {TRAINING_CTA.action}
          </button>
        </div>
        <div className="trn-cta-art-wrap" aria-hidden>
          <img className="trn-cta-art" src={ASSETS.P05_CTA} alt="" />
        </div>
      </footer>
    </section>
  );
}
