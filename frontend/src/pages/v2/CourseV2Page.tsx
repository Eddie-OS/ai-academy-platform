import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Mic,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usesFixtureData } from '@/app/fixtureSource';
import { isRegressionMode } from '@/app/regressionMode';
import { useDialogMotion } from '@/shared/motion/useDialogMotion';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import { redLightReasonOf, WarningLight } from '@/shared/ui/WarningLight';
import { space } from '@/shared/theme/designTokens';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { courseApi, type Course, type CourseTrialCalendarItem } from '@/shared/api/courses';
import { metricsApi, type CourseMonthlyOverview } from '@/shared/api/metrics';
import { formatMetricInt } from '@/shared/metrics/cockpitMetrics';
import { CourseFormModal } from '@/features/course/CourseFormModal';
import { CourseBasicInfo } from '@/features/course/CourseBasicInfo';
import { CourseInitiateTab } from '@/features/course/CourseInitiateTab';
import { CourseDevelopTab } from '@/features/course/CourseDevelopTab';
import { CourseSelfcheckTab } from '@/features/course/CourseSelfcheckTab';
import { CourseReviewsTab } from '@/features/course/CourseReviewsTab';
import { CourseTrialsTab } from '@/features/course/CourseTrialsTab';
import { CourseMaterialsTab } from '@/features/course/CourseMaterialsTab';
import { CourseStateLogTab } from '@/features/course/CourseStateLogTab';
import {
  COURSE_OBJECT_TYPE_CODE,
  COURSE_REVIEW_OBJECT_TYPE_CODE,
  COURSE_REVIEW_STATE_FIELD,
  COURSE_STATE_FIELDS,
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  useBusinessDomains,
  useDicts,
  useDomainLabel,
  useFieldEnums,
  useMachines,
} from '@/features/course/courseMeta';
import {
  boardCardsToCourses,
  courseToBoardCard,
  EMPTY_COURSE_FILTER,
  filterForCourseKpi,
  COURSE_MONTHLY_OVERVIEW_QUERY_KEY,
  invalidateCourseListAndMetrics,
  selectedCourseKpiId,
  toCourseApiFilter,
  type CourseWorkbenchFilter,
  type LiveCourseCard,
} from '@/features/course/courseFilters';
import {
  COURSE_ACTION_AVAILABILITY,
  COURSE_ACTION_ORDER,
  COURSE_BOARD,
  COURSE_CALENDAR,
  courseSessionsForDay,
  COURSE_CHANGELOG,
  COURSE_CHECKLIST_PERCENT,
  COURSE_CHECK_ITEMS,
  COURSE_DETAIL_ACTIVE_TAB,
  COURSE_DETAIL_FIELDS,
  COURSE_DETAIL_TABS,
  COURSE_FILTERS,
  COURSE_KPIS,
  COURSE_LIGHT_LABELS,
  COURSE_MATERIALS,
  COURSE_OVERVIEW,
  COURSE_OWNER,
  COURSE_REVIEW_TIMELINE,
  COURSE_SELECTED_ID,
  COURSE_STATE_LOG,
  COURSE_TRIAL,
  COURSE_TYPE,
  COURSE_VERSIONS,
  COURSE_VERSION_SUMMARY,
  type BoardColumn,
  type CourseCard,
  type CourseKpiId,
} from '@/fixtures/course';
import { formatMonthDayWeekday } from '@/fixtures/fixtureClock';
import { courseKpiValues, createCourseBoardState } from './courseBoardMock';
import './CourseV2Page.css';

/**
 * P03 课程工作台（《设计文档 V2.0》第 7 章）。
 *
 * <p>五个区域各带 {@code data-region}，编号沿用文档 7「区域坐标」表，但<b>版式已按业务
 * 裁决改过</b>：课程详情不再是右侧常驻的 R8 那一栏，改为双击课程卡后的弹窗。腾出来的
 * 474px 全部还给看板 —— 看板通栏 1364px、高 518px，七列列宽从 119 放大到 188.6，
 * 课程名两行不再需要按 7 个汉字掐。原先左栏底部那 80px 空白也一并没了。
 *
 * <p>为什么是双击而不是单击：单击仍然是「选中这张卡」，看板上一次只有一张卡是选中态
 * （15 组件矩阵的 Card selected）。单击就弹窗的话，运营在七列之间比对课程时每点一下
 * 都会被弹窗挡住整屏。键盘用户按回车等价于双击。
 *
 * <p>字段口径与 V2.0 表面文字的出入逐条写在 {@link file://./../../fixtures/course.ts} 头注里。
 * 核心三条：没有「轨道」这个字段、`评审决策` 没有子状态、材料快照不是可执行动作。
 */
const COURSE_PAGE_SIZE = 20;

export function CourseV2Page() {
  const regression = isRegressionMode();
  const fixture = usesFixtureData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const openTrialTab = params.get('tab') === '试讲';
  const [filters, setFilters] = useState<CourseWorkbenchFilter>(EMPTY_COURSE_FILTER);
  const [pageNum, setPageNum] = useState(1);
  const [selectedId, setSelectedId] = useState(COURSE_SELECTED_ID);
  const [opened, setOpened] = useState<CourseCard | null>(null);
  const [creating, setCreating] = useState(false);
  const fixtureCourses = boardCardsToCourses();

  const live = useQuery({
    queryKey: ['courses', 'v2', 'page', filters, pageNum, COURSE_PAGE_SIZE],
    queryFn: () => courseApi.page(toCourseApiFilter(filters), pageNum, COURSE_PAGE_SIZE),
    enabled: !fixture,
  });

  const quantity = useQuery({
    queryKey: ['metrics', 'quantity', 'courses'],
    queryFn: () => metricsApi.quantity('courses'),
    enabled: !fixture,
  });

  const selectedKpi = selectedCourseKpiId(filters);

  useEffect(() => {
    if (regression || fixture || focus) return;
    const records = live.data?.records ?? [];
    if (records.length === 0) return;
    setSelectedId((current) =>
      records.some((course) => course.courseNo === current) ? current : (records[0]?.courseNo ?? current),
    );
  }, [live.data, regression, fixture, focus]);

  useEffect(() => {
    if (regression || !openTrialTab || !focus) return;
    if (!fixture && live.isLoading) return;
    const records = fixture ? fixtureCourses : (live.data?.records ?? []);
    const hit = records.find((course) => course.courseNo === focus || course.courseName === focus);
    const card = hit
      ? courseToBoardCard(hit)
      : { id: focus, name: focus, owner: '', light: 'NONE' as const, stalledDays: 0 };
    setSelectedId(card.id);
    setOpened(card);
  }, [regression, openTrialTab, focus, fixture, fixtureCourses, live.data, live.isLoading]);

  const setFilter = useCallback(<K extends keyof CourseWorkbenchFilter>(
    key: K,
    value: CourseWorkbenchFilter[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPageNum(1);
  }, []);

  /*
   * 双击只开本页弹窗。跳到 /courses/:id 会整页换成业务列表 + 业务详情，
   * 看板、日历、数据概览全部消失 —— 那是把复刻件点穿了，不是「看详情」。
   */
  const openCard = useCallback((card: CourseCard) => {
    setOpened(card);
  }, []);

  return (
    <div className="crs v2-page">
      <div className="crs-main">
        <KpiRow
          quantity={quantity.data}
          selectedId={selectedKpi}
          onSelect={(kpiId) => {
            setFilters((current) =>
              selectedCourseKpiId(current) === kpiId && kpiId !== 'total'
                ? EMPTY_COURSE_FILTER
                : filterForCourseKpi(kpiId),
            );
            setPageNum(1);
          }}
        />
        <FilterBar
          regression={regression}
          filters={filters}
          onChange={setFilter}
          onReset={() => {
            setFilters(EMPTY_COURSE_FILTER);
            setPageNum(1);
          }}
          onCreate={() => setCreating(true)}
        />
        {regression ? (
          <Board
            columns={COURSE_BOARD}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={openCard}
          />
        ) : (
          <CourseTablePanel
            courses={fixture ? fixtureCourses : (live.data?.records ?? [])}
            total={fixture ? fixtureCourses.length : (live.data?.total ?? 0)}
            pageNum={pageNum}
            pageSize={COURSE_PAGE_SIZE}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={openCard}
            onPageChange={setPageNum}
          />
        )}
        <div className="crs-bottom">
          <CalendarPanel />
          <OverviewPanel />
        </div>
      </div>

      {opened && (
        <CourseDetailModal
          card={opened}
          regression={regression}
          initialTab={openTrialTab ? '试讲' : undefined}
          onClose={() => {
            setOpened(null);
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && focused.closest('[data-testid="course-row"]')) {
              focused.blur();
            }
          }}
        />
      )}

      <CourseFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          invalidateCourseListAndMetrics(queryClient);
          navigate(`/courses/${id}`);
        }}
      />
    </div>
  );
}

const COURSE_KPI_ICONS: Record<CourseKpiId, LucideIcon> = {
  total: BookOpen,
  developing: SlidersHorizontal,
  reviewing: ClipboardCheck,
  pendingTrial: Mic,
  published: Rocket,
};

const COURSE_KPI_TONES: Record<CourseKpiId, string> = {
  total: '#5B82FF',
  developing: '#4E70DB',
  reviewing: '#3974FA',
  pendingTrial: '#7C6CF0',
  published: '#3FA9C9',
};

const KPI_DELTA_BASELINE = '月度环比（较上月）';

/** R3 五张 KPI。回归模式用冻结看板存量；产品模式与列表同一份 quantity 接口。 */
function KpiRow({
  quantity,
  selectedId,
  onSelect,
}: {
  quantity?: Record<string, number>;
  selectedId: CourseKpiId;
  onSelect: (id: CourseKpiId) => void;
}) {
  const frozen = isRegressionMode();
  const fixture = usesFixtureData();
  const fixtureValues = courseKpiValues(createCourseBoardState());
  return (
    <section className="crs-kpis" data-region="R3" aria-label="课程指标概览">
      {COURSE_KPIS.map((kpi) => {
        const fixtureValue = fixtureValues[kpi.id].toLocaleString('en-US');
        const delta = formatKpiDelta(kpi.deltaPercent);
        if (frozen) {
          return (
            <article className="crs-kpi" key={kpi.id} data-testid="course-kpi" data-kpi={kpi.id}>
              <p className="crs-kpi-label">{kpi.label}</p>
              <div className="crs-kpi-nums">
                <p className="crs-kpi-value"><AnimatedNumber value={fixtureValue} duration={520} /></p>
                <p className="crs-kpi-delta">{delta}</p>
              </div>
            </article>
          );
        }
        const Icon = COURSE_KPI_ICONS[kpi.id];
        const tone = COURSE_KPI_TONES[kpi.id];
        const liveValue = fixture ? fixtureValue : formatMetricInt(quantity?.[kpi.id]);
        const selected = selectedId === kpi.id;
        return (
          <article
            className="crs-kpi"
            key={kpi.id}
            data-testid="course-kpi"
            data-kpi={kpi.id}
            data-selected={selected ? 'true' : undefined}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => onSelect(kpi.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(kpi.id);
              }
            }}
          >
            <div className="crs-kpi-top">
              <p className="crs-kpi-label">{kpi.label}</p>
              <span className="crs-kpi-plate" style={{ color: tone, background: `${tone}33` }} aria-hidden>
                <Icon size={16} strokeWidth={1.8} />
              </span>
            </div>
            <p className="crs-kpi-value"><AnimatedNumber value={liveValue} duration={520} /></p>
            <p className="crs-kpi-foot">
              <span className="crs-kpi-delta">—</span>
              <span className="crs-kpi-baseline">{KPI_DELTA_BASELINE}</span>
            </p>
          </article>
        );
      })}
    </section>
  );
}

function formatKpiDelta(percent: number): string {
  return `${percent < 0 ? '↓' : '↑'} ${Math.abs(percent).toFixed(1)}%`;
}

/**
 * R4 筛选器。
 *
 * <p>回归模式保持两行冻结按钮（8 + 28 + 8 + 28 + 8 = 80），避免打穿 P03 视觉门禁。
 * 产品模式一行：七个下拉 + 搜索 + 新建，接到 {@code /api/courses}，取值来自元数据（纪律 STK-1）。
 */
function FilterBar({
  regression,
  filters,
  onChange,
  onReset,
  onCreate,
}: {
  regression: boolean;
  filters: CourseWorkbenchFilter;
  onChange: <K extends keyof CourseWorkbenchFilter>(key: K, value: CourseWorkbenchFilter[K]) => void;
  onReset: () => void;
  onCreate: () => void;
}) {
  if (regression) {
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

  return (
    <section className="crs-filters" data-region="R4" aria-label="课程筛选">
      <div className="crs-filter-row">
        <CourseFilterSelect
          label="领域"
          field="domainCode"
          value={filters.domainCode}
          onChange={onChange}
        />
        <CourseFilterSelect
          label="课程类型"
          field="categoryCode"
          value={filters.categoryCode}
          onChange={onChange}
        />
        <CourseFilterSelect
          label="开发状态"
          field="devState"
          value={filters.devState}
          onChange={onChange}
        />
        <CourseFilterSelect
          label="自检状态"
          field="selfcheckState"
          value={filters.selfcheckState}
          onChange={onChange}
        />
        <CourseFilterSelect
          label="评审状态"
          field="reviewRecordState"
          value={filters.reviewRecordState}
          onChange={onChange}
        />
        <CourseFilterSelect
          label="试讲状态"
          field="trialState"
          value={filters.trialState}
          onChange={onChange}
        />
        <CourseFilterSelect
          label="灯色"
          field="light"
          value={filters.light}
          onChange={onChange}
        />
        <div className="crs-search">
          <Search size={14} color={colorV2.textTertiary} aria-hidden />
          <input
            type="search"
            placeholder="搜索课程ID或名称"
            aria-label="搜索课程"
            value={filters.keyword}
            onChange={(event) => onChange('keyword', event.target.value)}
          />
        </div>
        <button className="crs-filter-reset" type="button" onClick={onReset}>
          <RotateCcw size={13} aria-hidden />
          重置
        </button>
        <button className="crs-create" type="button" onClick={onCreate}>
          <Plus size={14} aria-hidden />
          <span>新建课程</span>
        </button>
      </div>
    </section>
  );
}

function measureSelectWidth(el: HTMLSelectElement, labels: string[]): number {
  const cs = getComputedStyle(el);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return el.getBoundingClientRect().width;
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const textW = labels.reduce((max, text) => Math.max(max, ctx.measureText(text).width), 0);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  return Math.ceil(textW + pad + border + 2);
}

function CourseFilterSelect({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: Exclude<keyof CourseWorkbenchFilter, 'keyword' | 'mainState'>;
  value: string;
  onChange: <K extends keyof CourseWorkbenchFilter>(key: K, value: CourseWorkbenchFilter[K]) => void;
}) {
  const options = useCourseFilterOptions(field);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [controlWidth, setControlWidth] = useState<number | null>(null);
  const selectedLabel = value === '' ? '全部' : (options.find((item) => item.value === value)?.label ?? value);

  useLayoutEffect(() => {
    const el = selectRef.current;
    if (!el) return;
    setControlWidth(measureSelectWidth(el, [selectedLabel]));
  }, [selectedLabel]);

  return (
    <label className="crs-filter crs-filter-select" data-testid="course-filter">
      <span className="crs-filter-label">{label}</span>
      <select
        ref={selectRef}
        aria-label={label}
        value={value}
        data-empty={value === '' ? 'true' : 'false'}
        style={controlWidth == null ? undefined : { width: controlWidth }}
        onChange={(event) => onChange(field, event.target.value)}
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function useCourseFilterOptions(field: Exclude<keyof CourseWorkbenchFilter, 'keyword' | 'mainState'>) {
  const dicts = useDicts();
  const machines = useMachines();
  const fieldEnums = useFieldEnums();
  const businessDomains = useBusinessDomains();

  const statesOf = (stateField: string, objectType = COURSE_OBJECT_TYPE_CODE) =>
    machines.data
      ?.find((machine) => machine.objectType === objectType && machine.stateField === stateField)
      ?.states.filter((state) => state !== '（空）') ?? [];

  if (field === 'domainCode') {
    return businessDomains.map((domain) => ({ value: domain, label: domain }));
  }
  if (field === 'categoryCode') {
    return (dicts.data?.[DICT_KEYS.courseCategory] ?? []).map((item) => ({
      value: item.code,
      label: item.name,
    }));
  }
  if (field === 'devState') return statesOf(COURSE_STATE_FIELDS.dev).map((state) => ({ value: state, label: state }));
  if (field === 'selfcheckState') {
    return statesOf(COURSE_STATE_FIELDS.selfcheck).map((state) => ({ value: state, label: state }));
  }
  if (field === 'reviewRecordState') {
    return statesOf(COURSE_REVIEW_STATE_FIELD, COURSE_REVIEW_OBJECT_TYPE_CODE).map((state) => ({
      value: state,
      label: state,
    }));
  }
  if (field === 'trialState') {
    return statesOf(COURSE_STATE_FIELDS.trial).map((state) => ({ value: state, label: state }));
  }
  return (fieldEnums.data?.[FIELD_ENUM_KEYS.light] ?? []).map((code) => ({
    value: code,
    label: COURSE_LIGHT_LABELS[code] ?? code,
  }));
}

/**
 * 十二列合计按比例铺满通栏。名称列最宽，灯色列最窄（与需求列表同一套短标签）。
 */
const COURSE_COLUMN_WIDTHS = [90, 168, 88, 88, 64, 88, 88, 88, 96, 88, 48, 88];

function CourseTablePanel({
  courses,
  total,
  pageNum,
  pageSize,
  selectedId,
  onSelect,
  onOpen,
  onPageChange,
}: {
  courses: Course[];
  total: number;
  pageNum: number;
  pageSize: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (card: CourseCard) => void;
  onPageChange: (page: number) => void;
}) {
  const dicts = useDicts();
  const domainLabelOf = useDomainLabel();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = buildPageItems(totalPages, pageNum);
  const tableWidth = COURSE_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBackTop, setShowBackTop] = useState(false);

  const domainName = (code: string | null) => domainLabelOf(code);
  const categoryName = (code: string | null) => {
    if (!code) return null;
    return dicts.data?.[DICT_KEYS.courseCategory]?.find((item) => item.code === code)?.name ?? code;
  };

  const goPage = (page: number) => {
    onPageChange(page);
    scrollRef.current?.scrollTo({ top: 0 });
    setShowBackTop(false);
  };

  return (
    <section className="panel crs-table-panel" data-region="R5" aria-label="课程列表">
      <div className="panel-head">
        <h2 className="panel-title">课程列表</h2>
        <span className="crs-list-count">共 {total.toLocaleString('en-US')} 条</span>
      </div>

      <div
        className="crs-table-scroll"
        ref={scrollRef}
        onScroll={(event) => setShowBackTop(event.currentTarget.scrollTop > 40)}
      >
        <table className="crs-table">
          <colgroup>
            {COURSE_COLUMN_WIDTHS.map((width, index) => (
              <col key={index} style={{ width: `${((width / tableWidth) * 100).toFixed(4)}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>课程ID</th>
              <th>课程名称</th>
              <th>领域</th>
              <th>课程类型</th>
              <th>负责人</th>
              <th>立项状态</th>
              <th>开发状态</th>
              <th>自检状态</th>
              <th>评审状态</th>
              <th>试讲状态</th>
              <th>灯色</th>
              <th>剩余/逾期天数</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <CourseTableRow
                key={course.id}
                course={course}
                selected={course.courseNo === selectedId}
                domain={domainName(course.domainCode)}
                category={categoryName(course.categoryCode)}
                onSelect={() => onSelect(course.courseNo)}
                onOpen={() => onOpen(courseToBoardCard(course))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showBackTop && (
        <button
          className="crs-back-top"
          type="button"
          onClick={() => {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            setShowBackTop(false);
          }}
        >
          回到顶部
        </button>
      )}

      <div className="crs-pager">
        <span className="crs-pager-total">共 {total.toLocaleString('en-US')} 条</span>
        <button className="crs-pager-size" type="button">
          {pageSize} 条/页
          <ChevronDown size={13} color={colorV2.textTertiary} aria-hidden />
        </button>
        <span className="crs-pager-pages">
          <button
            className="crs-pager-step"
            type="button"
            aria-label="上一页"
            disabled={pageNum === 1}
            onClick={() => goPage(Math.max(1, pageNum - 1))}
          >
            <ChevronLeft size={13} aria-hidden />
          </button>
          {pageItems.map((item, index) =>
            item === null ? (
              <span className="crs-pager-gap" key={`gap-${index}`} aria-hidden>
                …
              </span>
            ) : (
              <button
                className="crs-pager-page"
                key={item}
                type="button"
                data-current={item === pageNum}
                aria-current={item === pageNum ? 'page' : undefined}
                onClick={() => goPage(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            className="crs-pager-step"
            type="button"
            aria-label="下一页"
            disabled={pageNum >= totalPages}
            onClick={() => goPage(Math.min(totalPages, pageNum + 1))}
          >
            <ChevronRight size={13} aria-hidden />
          </button>
        </span>
        <PagerJump pageNum={pageNum} totalPages={totalPages} onJump={goPage} />
      </div>
    </section>
  );
}

function CourseTableRow({
  course,
  selected,
  domain,
  category,
  onSelect,
  onOpen,
}: {
  course: Course;
  selected: boolean;
  domain: string | null;
  category: string | null;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <tr
      data-testid="course-row"
      data-course={course.courseNo}
      data-selected={selected}
      aria-selected={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
    >
      <td className="crs-cell-id" title={course.courseNo}>
        {course.courseNo}
      </td>
      <td className="crs-cell-name" title={course.courseName}>
        {course.courseName}
      </td>
      <td title={domain ?? undefined}>{domain ?? <Blank />}</td>
      <td title={category ?? undefined}>{category ?? <Blank />}</td>
      <td>{course.ownerName || course.ownerNo || <Blank />}</td>
      <td>
        <StateTag value={course.mainState} />
      </td>
      <td>
        <StateTag value={course.devState} />
      </td>
      <td>
        <StateTag value={course.selfcheckState} />
      </td>
      <td>
        <StateTag value={course.reviewRecordState} />
      </td>
      <td>
        <StateTag value={course.trialState} />
      </td>
      <td>
        <CourseLightCell course={course} />
      </td>
      <td className="crs-cell-days">
        {course.lightDays == null ? <Blank /> : `${course.lightDays} 天`}
      </td>
    </tr>
  );
}

function CourseLightCell({ course }: { course: Course }) {
  if (!course.light || course.light === 'NONE') {
    return <WarningLight color="NONE" short />;
  }
  if (course.light === 'RED') {
    return (
      <WarningLight
        color="RED"
        reason={redLightReasonOf(course.lightReason)}
        daysShownInSeparateColumn
        short
      />
    );
  }
  if (course.light === 'BLUE' || course.light === 'YELLOW') {
    return <WarningLight color={course.light} daysShownInSeparateColumn short />;
  }
  return <WarningLight color="NONE" short />;
}

function StateTag({ value }: { value: string | null | undefined }) {
  if (!value) return <Blank />;
  return (
    <span className="crs-state-tag">
      <span className="crs-state-dot" aria-hidden />
      {value}
    </span>
  );
}

/** 空值占位。设计规范 3.3：`—` 只表示「无数据」，零值要显示 0 */
function Blank() {
  return <span className="crs-blank">—</span>;
}

function buildPageItems(totalPages: number, current = 1): Array<number | null> {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, current]);
  for (let page = current - 1; page <= current + 1; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }
  if (current <= 3) {
    [2, 3, 4, 5].forEach((page) => {
      if (page <= totalPages) pages.add(page);
    });
  }
  if (current >= totalPages - 2) {
    for (let page = totalPages - 4; page <= totalPages; page += 1) {
      if (page >= 1) pages.add(page);
    }
  }
  const sorted = [...pages].sort((left, right) => left - right);
  const items: Array<number | null> = [];
  for (const page of sorted) {
    const prev = items[items.length - 1];
    if (typeof prev === 'number' && page - prev > 1) items.push(null);
    items.push(page);
  }
  return items;
}

function PagerJump({
  pageNum,
  totalPages,
  onJump,
}: {
  pageNum: number;
  totalPages: number;
  onJump: (page: number) => void;
}) {
  const [draft, setDraft] = useState(String(pageNum));

  useEffect(() => {
    setDraft(String(pageNum));
  }, [pageNum]);

  function commit() {
    const next = Number.parseInt(draft, 10);
    if (!Number.isFinite(next)) {
      setDraft(String(pageNum));
      return;
    }
    onJump(Math.min(totalPages, Math.max(1, next)));
  }

  return (
    <span className="crs-pager-jump">
      跳至
      <input
        className="crs-pager-input"
        value={draft}
        inputMode="numeric"
        aria-label="跳至页码"
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      页
    </span>
  );
}

interface BoardHandlers {
  columns: readonly BoardColumn[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (card: CourseCard) => void;
}

/**
 * R5 七列课程看板：198,265,1364,518（通栏最大化后的坐标）。
 *
 * <p>列宽 188.6px × 7 + 列间距 6px × 6 + 外框内边距 3px × 2 = 1364，正好等于正文宽。
 * 文档原写的 119px 是「右侧还有 474px 详情栏」时的列宽，详情改弹窗后不再适用；
 * 列宽仍写成看板内宽的比例，逐列等宽这条约束没变（见 CSS 里的说明）。
 */
function Board({ columns, selectedId, onSelect, onOpen }: BoardHandlers) {
  return (
    <section className="crs-board" data-region="R5" aria-label="课程状态看板">
      {columns.map((column) => (
        <BoardColumnView
          key={column.id}
          column={column}
          selectedId={selectedId}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
    </section>
  );
}

function BoardColumnView({
  column,
  selectedId,
  onSelect,
  onOpen,
}: {
  column: BoardColumn;
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (card: CourseCard) => void;
}) {
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
          <CourseCardView
            key={card.id}
            card={card}
            selected={card.id === selectedId}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

/** 课程卡：188.6×126，卡间距 6px。单击选中，双击（或聚焦后回车）弹出课程详情 */
function CourseCardView({
  card,
  selected,
  onSelect,
  onOpen,
}: {
  card: CourseCard;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (card: CourseCard) => void;
}) {
  return (
    <article
      className="crs-card"
      data-testid="course-card"
      data-course={card.id}
      data-selected={selected}
      // 15 组件矩阵：Card selected 用 aria-current，不是 aria-selected
      aria-current={selected ? 'true' : undefined}
      role="button"
      tabIndex={0}
      title="双击查看课程详情"
      onClick={() => onSelect(card.id)}
      onDoubleClick={() => onOpen(card)}
      /* 键盘上没有「双击」。回车与空格等价于双击，否则这张卡对键盘用户就是死的 */
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(card.id);
        onOpen(card);
      }}
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

function monthDateRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

function uniqueTrialDays(items: readonly CourseTrialCalendarItem[]): number[] {
  return [...new Set(items.map((item) => Number(item.trialDate.slice(-2))))].sort((a, b) => a - b);
}

function trialRoundText(item: CourseTrialCalendarItem): string {
  if (item.roundNo != null) return String(item.roundNo);
  if (item.roundLabel) {
    const digits = item.roundLabel.match(/\d+/);
    return digits ? digits[0] : item.roundLabel;
  }
  return '—';
}

function formatTrialAgendaLine(item: CourseTrialCalendarItem): string {
  const [, month, day] = item.trialDate.split('-');
  return `${Number(month)}月${Number(day)}日，课程名称：${item.courseName}，试讲轮次：${trialRoundText(item)}，讲师：${item.lecturerName ?? '—'}，参与人数：${item.audienceCount ?? '—'}。`;
}

function formatOverviewScope(value: string | null | undefined, mom: string | null | undefined): string {
  if (value == null) return '—';
  return mom ? `${value} + ${mom}` : value;
}

/** R6：回归模式仍是冻结排期日历；产品模式改为试讲日历，右侧只列试讲。 */
function CalendarPanel() {
  const regression = usesFixtureData();
  const { year: baseYear, month: baseMonth, selectedDate, scheduledDays } = COURSE_CALENDAR;
  const defaultDay = Number(selectedDate.slice(-2));
  const today = new Date();

  const [year, setYear] = useState(regression ? baseYear : today.getFullYear());
  const [month, setMonth] = useState(regression ? baseMonth : today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(regression ? defaultDay : today.getDate());
  const [fullOpen, setFullOpen] = useState(false);

  const shownYear = regression ? baseYear : year;
  const shownMonth = regression ? baseMonth : month;
  const shownDay = regression ? defaultDay : selectedDay;
  const inBaseMonth = shownYear === baseYear && shownMonth === baseMonth;
  const range = monthDateRange(shownYear, shownMonth);
  const liveTrials = useQuery({
    queryKey: ['courses', 'trial-calendar', range.from, range.to],
    queryFn: () => courseApi.trialCalendar(range.from, range.to),
    enabled: !regression,
  });
  const trialItems = liveTrials.data ?? [];
  const dots = regression
    ? inBaseMonth
      ? scheduledDays
      : []
    : uniqueTrialDays(trialItems);
  const sessions = regression && inBaseMonth ? courseSessionsForDay(shownDay) : [];
  const dayTrials = trialItems.filter((item) => Number(item.trialDate.slice(-2)) === shownDay);
  const iso = `${shownYear}-${String(shownMonth).padStart(2, '0')}-${String(shownDay).padStart(2, '0')}`;
  const title = regression ? '课程排期日历' : '课程试讲日历';
  const fullLabel = regression ? '查看完整排期日历' : '查看完整试讲日历';
  const emptyDay = regression ? '当日没有排期' : '当日没有试讲';

  const shiftMonth = (delta: number) => {
    if (regression) return;
    const next = new Date(Date.UTC(shownYear, shownMonth - 1 + delta, 1));
    const nextYear = next.getUTCFullYear();
    const nextMonth = next.getUTCMonth() + 1;
    const days = new Date(nextYear, nextMonth, 0).getDate();
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDay((current) => Math.min(current, days));
  };

  const goToday = () => {
    if (regression) return;
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDay(now.getDate());
  };

  return (
    <section className="panel crs-calendar" data-region="R6" aria-label={title}>
      <h2 className="panel-title crs-sub-title">{title}</h2>

      <div className="crs-calendar-body">
        <div className="crs-cal-side">
          <div className="crs-month">
            <button type="button" aria-label="上一月" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={14} color={colorV2.textTertiary} aria-hidden />
            </button>
            <span>
              {shownYear} 年 {shownMonth} 月
            </span>
            <button type="button" aria-label="下一月" onClick={() => shiftMonth(1)}>
              <ChevronRight size={14} color={colorV2.textTertiary} aria-hidden />
            </button>
            <button type="button" className="crs-today-btn" onClick={goToday}>
              今天
            </button>
          </div>

          <MonthGrid
            year={shownYear}
            month={shownMonth}
            selectedDay={shownDay}
            scheduledDays={dots}
            onSelectDay={regression ? undefined : setSelectedDay}
          />
        </div>

        <div className="crs-sessions">
          <div className="crs-sessions-head">
            <p className="crs-sessions-date">{formatMonthDayWeekday(iso)}</p>
            {regression ? (
              <span className="crs-sessions-link">{fullLabel}</span>
            ) : (
              <button
                className="crs-sessions-link"
                type="button"
                onClick={() => setFullOpen(true)}
              >
                {fullLabel}
              </button>
            )}
          </div>

          <div className="crs-session-list">
            {regression ? (
              sessions.length === 0 ? (
                <p className="crs-session-empty">{emptyDay}</p>
              ) : (
                sessions.map((session) => (
                  <div className="crs-session" key={`${session.time}-${session.course}`} data-testid="calendar-session">
                    <span className="crs-session-time">{session.time}</span>
                    <div className="crs-session-main">
                      <span className="crs-session-course" title={session.course}>
                        {session.course}
                        <em>{session.subtitle}</em>
                      </span>
                      <span className="crs-session-meta">{session.meta}</span>
                    </div>
                    <span className="crs-session-tag" data-tone={session.tagTone}>
                      {session.tag}
                    </span>
                  </div>
                ))
              )
            ) : dayTrials.length === 0 ? (
              <p className="crs-session-empty">{emptyDay}</p>
            ) : (
              dayTrials.map((item) => (
                <p className="crs-trial-line" key={`${item.courseId}-${item.trialDate}-${item.roundNo ?? item.roundLabel}`}>
                  {formatTrialAgendaLine(item)}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {fullOpen && (
        <FullCalendarModal
          year={shownYear}
          month={shownMonth}
          selectedDay={shownDay}
          scheduledDays={dots}
          trialItems={trialItems}
          onSelectDay={setSelectedDay}
          onShiftMonth={shiftMonth}
          onToday={goToday}
          onClose={() => setFullOpen(false)}
        />
      )}
    </section>
  );
}

/**
 * 完整试讲日历弹窗。只在产品模式打开，右侧只列试讲，不再混入评审排期。
 */
function FullCalendarModal({
  year,
  month,
  selectedDay,
  scheduledDays,
  trialItems,
  onSelectDay,
  onShiftMonth,
  onToday,
  onClose,
}: {
  year: number;
  month: number;
  selectedDay: number;
  scheduledDays: readonly number[];
  trialItems: readonly CourseTrialCalendarItem[];
  onSelectDay: (day: number) => void;
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
  onClose: () => void;
}) {
  const { closing, requestClose } = useDialogMotion(onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const dayTrials = trialItems.filter((item) => item.trialDate === iso);
  const monthDays = [...new Set(trialItems.map((item) => item.trialDate))].sort();

  return (
    <div className="crs-modal-mask" data-closing={closing} role="presentation" onClick={requestClose}>
      <div
        className="crs-modal crs-cal-full"
        role="dialog"
        aria-modal="true"
        aria-label="完整试讲日历"
        data-testid="course-calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="crs-modal-close" type="button" aria-label="关闭完整试讲日历" onClick={requestClose}>
          <X size={16} aria-hidden />
        </button>

        <header className="crs-cal-full-head">
          <h2 className="crs-cal-full-title">完整试讲日历</h2>
          <div className="crs-month">
            <button type="button" aria-label="上一月" onClick={() => onShiftMonth(-1)}>
              <ChevronLeft size={14} color={colorV2.textTertiary} aria-hidden />
            </button>
            <span>
              {year} 年 {month} 月
            </span>
            <button type="button" aria-label="下一月" onClick={() => onShiftMonth(1)}>
              <ChevronRight size={14} color={colorV2.textTertiary} aria-hidden />
            </button>
            <button type="button" className="crs-today-btn" onClick={onToday}>
              今天
            </button>
          </div>
        </header>

        <div className="crs-cal-full-body">
          <div className="crs-cal-full-cal">
            <MonthGrid
              year={year}
              month={month}
              selectedDay={selectedDay}
              scheduledDays={scheduledDays}
              onSelectDay={onSelectDay}
            />
          </div>

          <div className="crs-cal-full-agenda">
            <p className="crs-sessions-date">{formatMonthDayWeekday(iso)}</p>
            <div className="crs-session-list">
              {dayTrials.length === 0 ? (
                <p className="crs-session-empty">当日没有试讲</p>
              ) : (
                dayTrials.map((item) => (
                  <p className="crs-trial-line" key={`${item.courseId}-${item.trialDate}-${item.roundNo ?? item.roundLabel}`}>
                    {formatTrialAgendaLine(item)}
                  </p>
                ))
              )}
            </div>

            <h3 className="crs-cal-full-sub">本月全部试讲</h3>
            {monthDays.length === 0 ? (
              <p className="crs-session-empty">本月没有试讲</p>
            ) : (
              <ul className="crs-cal-full-month">
                {monthDays.map((dayIso) => (
                  <li key={dayIso}>
                    <button
                      type="button"
                      className="crs-cal-full-day-btn"
                      data-active={Number(dayIso.slice(-2)) === selectedDay}
                      onClick={() => onSelectDay(Number(dayIso.slice(-2)))}
                    >
                      {formatMonthDayWeekday(dayIso)}
                    </button>
                    {trialItems
                      .filter((item) => item.trialDate === dayIso)
                      .map((item) => (
                        <p className="crs-trial-line" key={`${item.courseId}-${item.roundNo ?? item.roundLabel}`}>
                          {formatTrialAgendaLine(item)}
                        </p>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * 月历格子。
 *
 * <p>年月一律取自 {@link COURSE_CALENDAR}，不在这里调 {@code new Date()}：回归模式下
 * 它是冻结的 2024 年 6 月，文档 0.3 与 15.1 都写明「不得使用今天」——用当前月的话基线
 * 截图每个月失效一次，而且失效方式是整块日历错位，看起来像布局坏了，实际只是日期变了。
 * 产品模式下它已经是真实当月，两种模式共用这一份渲染逻辑。
 */
function MonthGrid({
  year,
  month,
  selectedDay,
  scheduledDays,
  onSelectDay,
}: {
  year: number;
  month: number;
  selectedDay: number;
  scheduledDays: readonly number[];
  onSelectDay?: (day: number) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay() 里周日是 0，而这里表头从周一起，所以周日要挪到第 7 格
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

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
        const selected = day === selectedDay;
        const scheduled = scheduledDays.includes(day);
        /* 回归模式保持 span：点不了就不会进 A11Y-15 的小目标计数，基线几何也不变 */
        if (!onSelectDay) {
          return (
            <span
              className="crs-day"
              key={day}
              data-testid="calendar-day"
              data-selected={selected}
              data-scheduled={scheduled}
            >
              {day}
            </span>
          );
        }
        return (
          <button
            className="crs-day"
            key={day}
            type="button"
            data-testid="calendar-day"
            data-selected={selected}
            data-scheduled={scheduled}
            aria-pressed={selected}
            aria-label={`${month} 月 ${day} 日`}
            onClick={() => onSelectDay(day)}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/** R7：回归仍是本周三行冻结数；产品改为本月三指标表（指标 / 口径）。 */
function OverviewPanel() {
  const regression = usesFixtureData();
  const live = useQuery({
    queryKey: COURSE_MONTHLY_OVERVIEW_QUERY_KEY,
    queryFn: () => metricsApi.courseMonthlyOverview(),
    enabled: !regression,
  });
  const data: CourseMonthlyOverview | undefined = live.data;
  const rows = [
    { label: '新建课程数', scope: formatOverviewScope(data?.newCourses, data?.newCoursesMom) },
    { label: '课程评审一次通过率', scope: formatOverviewScope(data?.reviewFirstPass, data?.reviewFirstPassMom) },
    { label: '试讲一次通过率', scope: formatOverviewScope(data?.trialFirstPass, data?.trialFirstPassMom) },
  ];

  return (
    <section className="panel crs-overview" data-region="R7" aria-label="数据概览">
      <h2 className="panel-title crs-sub-title">{regression ? '数据概览（本周）' : '数据概览（本月）'}</h2>

      <div className="crs-overview-body">
        <div className="crs-overview-art-wrap">
          <img className="crs-overview-art" src={ASSETS.P03_OVERVIEW} alt="" aria-hidden />
        </div>

        {regression ? (
          <dl className="crs-overview-list">
            {COURSE_OVERVIEW.map((item) => (
              <div className="crs-overview-item" key={item.id} data-testid="overview-item">
                <dt>{item.label}</dt>
                <dd>
                  <span className="crs-overview-value">{item.value}</span>
                  <span className="crs-overview-delta">{item.delta}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <table className="crs-overview-table">
            <thead>
              <tr>
                <th>指标</th>
                <th>口径</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/**
 * 课程详情弹窗。双击课程卡打开，Esc、遮罩、右上角关闭三条退出路径。
 *
 * <p>宽度 1100 而不是原来那 474 的详情栏：材料区是三栏、底部模块是 2×2，
 * 474px 下三个动作按钮就得折两行。弹窗不受右栏宽度限制，这里放宽到 1100，
 * 材料三栏与四个模块各自都能一屏读完。
 */
function CourseDetailModal({
  card,
  regression,
  initialTab,
  onClose,
}: {
  card: CourseCard;
  regression: boolean;
  initialTab?: '试讲';
  onClose: () => void;
}) {
  const { closing, requestClose } = useDialogMotion(onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  return (
    <div className="crs-modal-mask" data-closing={closing} role="presentation" onClick={requestClose}>
      <div
        className="crs-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`课程详情 · ${card.name}`}
        data-testid="course-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="crs-modal-close" type="button" aria-label="关闭课程详情" onClick={requestClose}>
          <X size={16} aria-hidden />
        </button>
        <DetailPanel
          card={card}
          regression={regression || usesFixtureData()}
          initialTab={initialTab}
          onRecordDeleted={requestClose}
        />
      </div>
    </div>
  );
}

const LIVE_DETAIL_TABS = [
  '基本信息',
  '立项',
  '开发',
  '自检',
  '评审',
  '试讲',
  '材料与版本',
  '状态流转日志',
] as const;

type LiveDetailTab = (typeof LIVE_DETAIL_TABS)[number];

/**
 * 课程详情正文。页签上方的标题、状态摘要不随页签变。
 *
 * <p>回归模式保持五个冻结页签、结论按钮与材料四模块同屏，P03 视觉门禁钉的就是这一屏。
 * 产品模式不渲染动作栏：这五个按钮只是 fixture 占位，点了也不会改状态。
 */
function DetailPanel({
  card,
  regression,
  initialTab,
  onRecordDeleted,
}: {
  card: CourseCard;
  regression: boolean;
  initialTab?: LiveDetailTab;
  onRecordDeleted?: () => void;
}) {
  return (
    <section className="panel crs-detail" data-testid="course-detail" aria-label="课程详情">
      <header className="crs-detail-head">
        <div className="crs-detail-title-row">
          <h2 className="crs-detail-name">{card.name}</h2>
          <span className="crs-detail-type">{COURSE_TYPE}</span>
        </div>
        <p className="crs-detail-meta">
          <span>{card.id}</span>
          <span>课程类型 · {COURSE_TYPE}</span>
          <span>负责人 · {card.owner || COURSE_OWNER}</span>
        </p>
      </header>

      <dl className="crs-status-card" aria-label="状态摘要">
        {COURSE_DETAIL_FIELDS.map((field) => (
          <div className="crs-field" key={field.label} data-testid="course-field">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      {regression && (
        <div className="crs-detail-actions">
          <ActionGuard
            availability={COURSE_ACTION_AVAILABILITY}
            gap={space.xs}
            actions={COURSE_ACTION_ORDER.map((action) => ({
              action,
              type: action === '录入结论=通过' ? ('primary' as const) : undefined,
              danger: action === '关闭课程开发',
              onClick: () => undefined,
            }))}
          />
        </div>
      )}

      {regression ? (
        <>
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
          <MaterialsBlock />
          <ModuleGrid />
        </>
      ) : (
        <LiveDetailTabs card={card} initialTab={initialTab} onRecordDeleted={onRecordDeleted} />
      )}
    </section>
  );
}

function LiveDetailTabs({
  card,
  initialTab,
  onRecordDeleted,
}: {
  card: CourseCard;
  initialTab?: LiveDetailTab;
  onRecordDeleted?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LiveDetailTab>(initialTab ?? '基本信息');
  const liveId = (card as LiveCourseCard).liveId;
  const live = Number.isFinite(liveId) && liveId > 0;
  const detail = useQuery({
    queryKey: ['courses', liveId, 'detail'],
    queryFn: () => courseApi.detail(liveId),
    enabled: live,
  });

  useEffect(() => {
    setActiveTab(initialTab ?? '基本信息');
  }, [card.id, initialTab]);

  return (
    <>
      <nav className="crs-tabs" aria-label="课程详情页签">
        {LIVE_DETAIL_TABS.map((tab) => (
          <button
            className="crs-tab"
            key={tab}
            type="button"
            data-testid="course-tab"
            data-active={tab === activeTab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="crs-detail-body crs-detail-body-tabs">
        <div className="crs-detail-sizer" aria-hidden>
          <MaterialsBlock />
          <ModuleGrid />
        </div>
        <div className="crs-detail-tab-pane">
          {live && detail.isLoading ? (
            <p className="crs-detail-empty">正在加载课程详情…</p>
          ) : live && detail.data ? (
            <LiveTabBody
              tab={activeTab}
              courseId={detail.data.id}
              course={detail.data}
              onEnteredSelfCheck={() => setActiveTab('自检')}
              onRecordDeleted={onRecordDeleted}
            />
          ) : (
            <MockTabBody tab={activeTab} />
          )}
        </div>
      </div>
    </>
  );
}

function LiveTabBody({
  tab,
  courseId,
  course,
  onEnteredSelfCheck,
  onRecordDeleted,
}: {
  tab: LiveDetailTab;
  courseId: number;
  course: Course;
  onEnteredSelfCheck?: () => void;
  onRecordDeleted?: () => void;
}) {
  switch (tab) {
    case '基本信息':
      return <CourseBasicInfo course={course} onDeleted={onRecordDeleted} />;
    case '立项':
      return <CourseInitiateTab course={course} />;
    case '开发':
      return <CourseDevelopTab course={course} onEnteredSelfCheck={onEnteredSelfCheck} />;
    case '自检':
      return <CourseSelfcheckTab course={course} />;
    case '评审':
      return <CourseReviewsTab course={course} />;
    case '试讲':
      return <CourseTrialsTab course={course} />;
    case '材料与版本':
      return <CourseMaterialsTab course={course} />;
    case '状态流转日志':
      return <CourseStateLogTab courseId={courseId} />;
  }
}

function MockTabBody({ tab }: { tab: LiveDetailTab }) {
  switch (tab) {
    case '基本信息':
      return (
        <dl className="crs-status-card" aria-label="基本信息">
          {COURSE_DETAIL_FIELDS.map((field) => (
            <div className="crs-field" key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      );
    case '立项':
    case '开发':
      return <p className="crs-detail-empty">演示数据没有这一页的完整台账，请双击真实课程卡片。</p>;
    case '自检':
      return <ChecklistModule />;
    case '评审':
      return (
        <div className="crs-module">
          <h3 className="crs-block-title">评审记录（第 1 轮）</h3>
          <ul className="crs-timeline">
            {COURSE_REVIEW_TIMELINE.map((item) => (
              <li key={item.at} data-phase={item.phase}>
                <span className="crs-timeline-dot" aria-hidden />
                <span className="crs-timeline-body">
                  <span className="crs-mini-at">{item.at}</span>
                  <span>{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case '试讲':
      return (
        <div className="crs-module">
          <h3 className="crs-block-title">试讲记录</h3>
          <p className="crs-trial-status">{COURSE_TRIAL.status}</p>
          <p className="crs-trial-note">预计试讲时间 {COURSE_TRIAL.expectedAt}</p>
          <p className="crs-trial-note">{COURSE_TRIAL.note}</p>
        </div>
      );
    case '材料与版本':
      return <MaterialsBlock />;
    case '状态流转日志':
      return (
        <div className="crs-module">
          <h3 className="crs-block-title">状态流转日志</h3>
          <ul className="crs-mini-list">
            {COURSE_STATE_LOG.map((item) => (
              <li key={item.at}>
                <span className="crs-mini-at">{item.at}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

/**
 * 课程材料与版本，页签 3 的正文。文档 7「默认状态与交互」点名这一块默认展开。
 *
 * <p><b>没有「新建版本」入口。</b>需求 R7：每条评审记录绑定一个课程材料版本，
 * 该版本为提交评审时系统自动生成。给这里加一个手工建版本的按钮，
 * 会让运营建出游离于评审轮次之外的版本，而评审记录找不到该绑哪一个。
 */
function MaterialsBlock() {
  return (
    <div className="crs-materials" data-testid="version-block">
      <div className="crs-materials-col">
        <h3 className="crs-block-title">版本列表</h3>

        <ul className="crs-version-list">
          {COURSE_VERSIONS.map((item) => (
            <li
              className="crs-version"
              key={item.version}
              data-testid="course-version"
              data-current={item.current}
            >
              <div className="crs-version-top">
                <span className="crs-version-no">{item.version}</span>
                {item.current && <span className="crs-version-tag">当前版本</span>}
              </div>
              <span className="crs-version-time">{item.snapshotAt}</span>
              <span className="crs-version-by">{item.operator}</span>
            </li>
          ))}
        </ul>

        <p className="crs-col-foot">查看全部版本</p>
      </div>

      <div className="crs-materials-col">
        <h3 className="crs-block-title">材料清单（V3）</h3>

        <ul className="crs-material-list">
          {COURSE_MATERIALS.map((item) => (
            <li className="crs-material" key={item.name} data-tone={item.tone}>
              <span className="crs-material-icon" aria-hidden />
              <span className="crs-material-body">
                <span className="crs-material-name">{item.name}</span>
                <span className="crs-material-ver">{item.version}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="crs-col-foot">查看全部材料</p>
      </div>

      <div className="crs-materials-col">
        <h3 className="crs-block-title">版本说明</h3>
        <p className="crs-version-summary">{COURSE_VERSION_SUMMARY}</p>

        <h4 className="crs-block-subtitle">变更记录</h4>
        <ul className="crs-changelog">
          {COURSE_CHANGELOG.map((item) => (
            <li className="crs-changelog-item" key={`${item.at}-${item.text}`}>
              <span className="crs-changelog-dot" aria-hidden />
              <span className="crs-changelog-body">
                <span className="crs-changelog-text">{item.text}</span>
                <span className="crs-changelog-at">
                  {item.at} · {item.by}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="crs-version-note">材料版本在提交评审时由系统自动快照，不支持手工创建</p>
        <p className="crs-col-foot">查看全部变更</p>
      </div>
    </div>
  );
}

/** 详情底部四个模块，2×2。每个模块只放摘要，完整清单在各自的「查看全部…」后面 */
function ModuleGrid() {
  return (
    <div className="crs-modules">
      <ChecklistModule />

      <div className="crs-module">
        <h3 className="crs-block-title">评审记录（第 1 轮）</h3>

        <ul className="crs-timeline">
          {COURSE_REVIEW_TIMELINE.map((item) => (
            <li key={item.at} data-phase={item.phase}>
              <span className="crs-timeline-dot" aria-hidden />
              <span className="crs-timeline-body">
                <span className="crs-mini-at">{item.at}</span>
                <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="crs-col-foot">查看全部评审记录</p>
      </div>

      <div className="crs-module">
        <h3 className="crs-block-title">试讲记录</h3>
        <p className="crs-trial-status">{COURSE_TRIAL.status}</p>
        <p className="crs-trial-note">预计试讲时间 {COURSE_TRIAL.expectedAt}</p>
        <p className="crs-trial-note">{COURSE_TRIAL.note}</p>
        <p className="crs-col-foot">查看试讲计划</p>
      </div>

      <div className="crs-module">
        <h3 className="crs-block-title">状态流转日志</h3>

        <ul className="crs-mini-list">
          {COURSE_STATE_LOG.map((item) => (
            <li key={item.at}>
              <span className="crs-mini-at">{item.at}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        <p className="crs-col-foot">查看完整日志</p>
      </div>
    </div>
  );
}

/** 自检完成度。文档 7「冻结数据」：Checklist 完成度 76% */
function ChecklistModule() {
  return (
    <div className="crs-module" data-testid="checklist-block">
      <div className="crs-block-head">
        <h3 className="crs-block-title">CheckList 自检</h3>
        {/* 百分比保留 1 位小数，整数也保留（设计规范 3.3） */}
        <span className="crs-percent">完成度 {COURSE_CHECKLIST_PERCENT.toFixed(1)}%</span>
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

      <ul className="crs-check-items">
        {COURSE_CHECK_ITEMS.map((item) => (
          <li key={item.name}>
            <span>{item.name}</span>
            <span className="crs-check-score">{item.score}</span>
          </li>
        ))}
      </ul>

      <p className="crs-col-foot">查看详情</p>
    </div>
  );
}
