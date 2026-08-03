import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { WarningLight } from '@/shared/ui/WarningLight';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import {
  COURSE_ACTION_AVAILABILITY,
  COURSE_ACTION_ORDER,
  COURSE_BOARD,
  COURSE_CALENDAR,
  COURSE_CALENDAR_SESSIONS,
  COURSE_CHECKLIST_PERCENT,
  COURSE_DETAIL_ACTIVE_TAB,
  COURSE_DETAIL_FIELDS,
  COURSE_DETAIL_TABS,
  COURSE_FILTERS,
  COURSE_KPIS,
  COURSE_OVERVIEW,
  COURSE_SELECTED_ID,
  COURSE_VERSIONS,
  type BoardColumn,
  type CourseCard,
} from '@/fixtures/course';
import './CourseV2Page.css';

/**
 * P03 课程工作台（《设计文档 V2.0》第 7 章）。
 *
 * <p>八个区域各带 {@code data-region}，编号与文档 7「区域坐标」表一一对应。
 * 版式与 P01／P02 都不同：R8 课程详情从 y=62 一直到 y=992（高 930），
 * 而左栏六个区域加起来只有 850 —— <b>左下角那 80px 的空白是设计稿本来的样子</b>，
 * 不要为了「填满」把日历或数据概览拉高。
 *
 * <p>字段口径与 V2.0 表面文字的出入逐条写在 {@link file://./../../fixtures/course.ts} 头注里。
 * 核心三条：没有「轨道」这个字段、`评审决策` 没有子状态、材料快照不是可执行动作。
 */
export function CourseV2Page() {
  return (
    <div className="crs v2-page">
      <div className="crs-main">
        <div className="crs-left">
          <KpiRow />
          <FilterBar />
          <Board />
          <div className="crs-bottom">
            <CalendarPanel />
            <OverviewPanel />
          </div>
        </div>
        <DetailPanel />
      </div>
    </div>
  );
}

/** R3 五张 KPI：198,62,875,98 */
function KpiRow() {
  return (
    <section className="crs-kpis" data-region="R3" aria-label="课程指标概览">
      {COURSE_KPIS.map((kpi) => (
        <article className="crs-kpi" key={kpi.id} data-testid="course-kpi" data-kpi={kpi.id}>
          <p className="crs-kpi-label">{kpi.label}</p>
          <p className="crs-kpi-value">{kpi.value}</p>
          <p className="crs-kpi-delta">{kpi.delta}</p>
        </article>
      ))}
    </section>
  );
}

/**
 * R4 筛选器：198,173,875,80。
 *
 * <p>80px 的高度不是留白，是<b>两行控件</b>：8 + 28 + 8 + 28 + 8 = 80。
 * P02 的筛选器只有 45px，那是一行。
 */
function FilterBar() {
  return (
    <section className="crs-filters" data-region="R4" aria-label="课程筛选">
      {COURSE_FILTERS.map((row, rowIndex) => (
        <div className="crs-filter-row" key={rowIndex}>
          {row.map((filter) => (
            <button className="crs-filter" key={filter.id} type="button" data-testid="course-filter">
              <span>{filter.label}</span>
              <ChevronDown size={14} color={colorV2.textTertiary} aria-hidden />
            </button>
          ))}

          {/* 搜索与新建只在第二行，跟着这一行右对齐 */}
          {rowIndex === 1 && (
            <>
              <div className="crs-search">
                <Search size={14} color={colorV2.textTertiary} aria-hidden />
                <input type="search" placeholder="搜索课程ID或名称" aria-label="搜索课程" />
              </div>
              <button className="crs-create" type="button">
                <Plus size={14} aria-hidden />
                <span>新建课程</span>
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * R5 七列课程看板：198,265,875,438。
 *
 * <p>列宽 119px × 7 + 列间距 6px × 6 + 外框内边距 3px × 2 = 875，正好等于区域宽。
 * 文档给的外框内边距是 8px，那样合计 885、超出 10px —— 让步的是内边距，
 * 因为 119px 是文档首要点明「必须照抄」的数（见 CSS 里的说明）。
 */
function Board() {
  return (
    <section className="crs-board" data-region="R5" aria-label="课程状态看板">
      {COURSE_BOARD.map((column) => (
        <BoardColumnView key={column.id} column={column} />
      ))}
    </section>
  );
}

function BoardColumnView({ column }: { column: BoardColumn }) {
  return (
    <div className="crs-col" data-testid="board-column" data-column={column.id}>
      <header className="crs-col-head">
        <span className="crs-col-title" title={column.title}>
          {column.title}
        </span>
        <span className="crs-col-count">{column.count}</span>
      </header>

      <div className="crs-col-cards">
        {column.cards.map((card) => (
          <CourseCardView key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

/** 课程卡：109×126，卡间距 6px（文档 7「内部几何」标注「必须照抄」） */
function CourseCardView({ card }: { card: CourseCard }) {
  const selected = card.id === COURSE_SELECTED_ID;

  return (
    <article
      className="crs-card"
      data-testid="course-card"
      data-course={card.id}
      data-selected={selected}
      // 15 组件矩阵：Card selected 用 aria-current，不是 aria-selected
      aria-current={selected ? 'true' : undefined}
    >
      <p className="crs-card-id">{card.id}</p>
      <p className="crs-card-name" title={card.name}>
        {card.name}
      </p>
      <p className="crs-card-owner">{card.owner}</p>

      <div className="crs-card-foot">
        {card.light === 'NONE' ? (
          <WarningLight color="NONE" short />
        ) : card.light === 'RED' ? (
          <WarningLight color="RED" reason={card.lightReason ?? 'OVERDUE'} daysShownInSeparateColumn short />
        ) : (
          <WarningLight color={card.light} daysShownInSeparateColumn short />
        )}
        <span className="crs-card-stalled">
          {card.stalledDays === null ? <Blank /> : `${card.stalledDays} 天`}
        </span>
      </div>
    </article>
  );
}

/** 空值占位。设计规范 3.3：`—` 只表示「无数据」，零值要显示 0 */
function Blank() {
  return <span className="crs-blank">—</span>;
}

/** R6 课程排期日历：198,718,533,194 */
function CalendarPanel() {
  return (
    <section className="panel crs-calendar" data-region="R6" aria-label="课程排期日历">
      <div className="panel-head crs-calendar-head">
        <h2 className="panel-title crs-sub-title">课程排期</h2>
        <div className="crs-month">
          <button type="button" aria-label="上一月">
            <ChevronLeft size={14} color={colorV2.textTertiary} aria-hidden />
          </button>
          <span>
            {COURSE_CALENDAR.year} 年 {COURSE_CALENDAR.month} 月
          </span>
          <button type="button" aria-label="下一月">
            <ChevronRight size={14} color={colorV2.textTertiary} aria-hidden />
          </button>
        </div>
      </div>

      <div className="crs-calendar-body">
        <MonthGrid />

        <div className="crs-sessions">
          <p className="crs-sessions-date">{COURSE_CALENDAR.selectedDate}</p>
          {COURSE_CALENDAR_SESSIONS.map((session) => (
            <div className="crs-session" key={session.time} data-testid="calendar-session">
              <span className="crs-session-time">{session.time}</span>
              <span className="crs-session-course" title={session.course}>
                {session.course}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * 2024 年 6 月的月历格子。
 *
 * <p>月份取自 fixture 而不是 {@code new Date()}：文档 0.3 与 15.1 都写明「不得使用今天」。
 * 用当前月的话，基线截图每个月失效一次，而且失效方式是整块日历错位 ——
 * 看起来像布局坏了，实际只是日期变了。
 */
function MonthGrid() {
  const { year, month, selectedDate, scheduledDays } = COURSE_CALENDAR;
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay() 里周日是 0，而这里表头从周一起，所以周日要挪到第 7 格
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedDay = Number(selectedDate.slice(-2));

  return (
    <div className="crs-month-grid" role="grid" aria-label={`${year} 年 ${month} 月排期`}>
      {WEEKDAYS.map((day) => (
        <span className="crs-weekday" key={day}>
          {day}
        </span>
      ))}

      {Array.from({ length: firstWeekday }, (_, index) => (
        <span className="crs-day crs-day-empty" key={`pad-${index}`} aria-hidden />
      ))}

      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return (
          <span
            className="crs-day"
            key={day}
            data-testid="calendar-day"
            data-selected={day === selectedDay}
            data-scheduled={scheduledDays.includes(day)}
          >
            {day}
          </span>
        );
      })}
    </div>
  );
}

/** R7 数据概览：743,718,330,194。内容非冻结数据，三个数全部由已冻结数据推出 */
function OverviewPanel() {
  return (
    <section className="panel crs-overview" data-region="R7" aria-label="数据概览">
      <h2 className="panel-title crs-sub-title">数据概览</h2>

      <div className="crs-overview-body">
        <dl className="crs-overview-list">
          {COURSE_OVERVIEW.map((item) => (
            <div className="crs-overview-item" key={item.id} data-testid="overview-item">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>

        <img className="crs-overview-art" src={ASSETS.A07} alt="" aria-hidden />
      </div>
    </section>
  );
}

/** R8 课程详情：1086,62,474,930 */
function DetailPanel() {
  const selected = COURSE_BOARD.flatMap((column) => column.cards).find(
    (card) => card.id === COURSE_SELECTED_ID,
  );

  return (
    <section className="panel crs-detail" data-region="R8" aria-label="课程详情">
      <header className="crs-detail-head">
        <p className="crs-detail-id">{selected?.id}</p>
        <h2 className="crs-detail-name">{selected?.name}</h2>
      </header>

      <nav className="crs-tabs" aria-label="课程详情页签">
        {COURSE_DETAIL_TABS.map((tab, index) => (
          <button
            className="crs-tab"
            key={tab}
            type="button"
            data-testid="course-tab"
            data-active={index === COURSE_DETAIL_ACTIVE_TAB}
          >
            {tab}
          </button>
        ))}
      </nav>

      <dl className="crs-fields">
        {COURSE_DETAIL_FIELDS.map((field) => (
          <div className="crs-field" key={field.label} data-testid="course-field">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      <ChecklistBlock />
      <VersionBlock />

      <footer className="crs-detail-actions">
        <ActionGuard
          availability={COURSE_ACTION_AVAILABILITY}
          actions={COURSE_ACTION_ORDER.map((action) => ({
            action,
            type: action === '录入结论=通过' ? ('primary' as const) : undefined,
            onClick: () => undefined,
          }))}
        />
      </footer>
    </section>
  );
}

/** 自检完成度。文档 7「冻结数据」：Checklist 完成度 76% */
function ChecklistBlock() {
  return (
    <div className="crs-block" data-testid="checklist-block">
      <div className="crs-block-head">
        <h3 className="crs-block-title">自检清单完成度</h3>
        {/* 百分比保留 1 位小数，整数也保留（设计规范 3.3） */}
        <span className="crs-percent">{COURSE_CHECKLIST_PERCENT.toFixed(1)}%</span>
      </div>
      <div
        className="crs-progress"
        role="progressbar"
        aria-valuenow={COURSE_CHECKLIST_PERCENT}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="crs-progress-fill" style={{ width: `${COURSE_CHECKLIST_PERCENT}%` }} />
      </div>
    </div>
  );
}

/**
 * 课程材料与版本。文档 7「默认状态与交互」点名这一块默认展开。
 *
 * <p><b>没有「新建版本」入口。</b>需求 R7：每条评审记录绑定一个课程材料版本，
 * 该版本为提交评审时系统自动生成。给这里加一个手工建版本的按钮，
 * 会让运营建出游离于评审轮次之外的版本，而评审记录找不到该绑哪一个。
 */
function VersionBlock() {
  return (
    <div className="crs-block crs-versions" data-testid="version-block">
      <h3 className="crs-block-title">课程材料与版本</h3>

      <ul className="crs-version-list">
        {COURSE_VERSIONS.map((item) => (
          <li className="crs-version" key={item.version} data-testid="course-version" data-current={item.current}>
            <span className="crs-version-no">{item.version}</span>
            <span className="crs-version-time">{item.snapshotAt}</span>
            {item.current && <span className="crs-version-tag">当前版本</span>}
          </li>
        ))}
      </ul>

      <p className="crs-version-note">材料版本在提交评审时由系统自动快照，不支持手工创建</p>
    </div>
  );
}