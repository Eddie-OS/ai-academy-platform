import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { App, Button } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Diamond,
  FileText,
  Info,
  Maximize2,
  Minimize2,
  Pencil,
  PieChart,
  Rocket,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { usesFixtureData } from '@/app/fixtureSource';
import { isRegressionMode } from '@/app/regressionMode';
import { ApiError } from '@/shared/api/client';
import {
  DEMAND_OBJECT_TYPE,
  demandApi,
  type Demand,
  type DemandFilter,
} from '@/shared/api/demands';
import { escalationsApi } from '@/shared/api/escalations';
import { transitionApi } from '@/shared/api/transitions';
import { invalidateDemandGraph } from '@/shared/query/invalidateGraph';
import type { ActionAvailability } from '@/shared/api/types';
import { Chart } from '@/shared/ui/v2/Chart';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber';
import { useDialogMotion } from '@/shared/motion/useDialogMotion';
import { Avatar } from '@/shared/ui/v2/Avatar';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { redLightReasonOf, WarningLight } from '@/shared/ui/WarningLight';
import { DemandEscalationsTab } from '@/features/demand/DemandEscalationsTab';
import { DemandStateLogTab } from '@/features/demand/DemandStateLogTab';
import { useIsOperator } from '@/shared/store/authStore';
import { ASSETS, colorV2 } from '@/shared/theme/designTokensV2';
import { space } from '@/shared/theme/designTokens';
import { DemandAttachments, DEMAND_REF_FIELDS } from '@/features/demand/DemandAttachments';
import { DemandFormModal } from '@/features/demand/DemandFormModal';
import { DemandReviewsTab } from '@/features/demand/DemandReviewsTab';
import { DemandOutletTab } from '@/features/demand/DemandOutletTab';
import { DemandCoursesTab } from '@/features/demand/DemandCoursesTab';
import { DemandAcceptanceTab } from '@/features/demand/DemandAcceptanceTab';
import { useDemandCloseLoop } from '@/features/demand/useDemandCloseLoop';
import {
  DEMAND_OBJECT_TYPE_CODE,
  DEMAND_STATE_FIELDS,
  FIELD_ENUM_KEYS,
  useDemandDomains,
  useDomainLabel,
  useEmployees,
  useFieldEnums,
  useMachines,
  useOutlets,
  useStates,
} from '@/features/demand/demandMeta';
import {
  countByStates,
  devStateOf,
  shareOf as situationShare,
  sliceTotal,
  solutionBucketOf,
} from '@/features/demand/demandSituation';
import {
  DEMAND_ACTION_AVAILABILITY,
  DEMAND_ACTION_ORDER,
  PRODUCT_DEMAND_ACTION_AVAILABILITY,
  PRODUCT_DEMAND_ACTION_ORDER,
  DEMAND_DATE_RANGE,
  DEMAND_DESCRIPTION,
  DEMAND_DESCRIPTION_MORE,
  DEMAND_DETAIL_ACTIVE_TAB,
  DEMAND_DETAIL_FIELDS,
  DEMAND_DETAIL_META,
  DEMAND_DETAIL_PEOPLE,
  DEMAND_DETAIL_SECTION_TITLE,
  DEMAND_DETAIL_TABS,
  DEMAND_DOMAIN_BARS,
  DEMAND_FEED,
  DEMAND_FILTERS,
  DEMAND_FUNNEL,
  DEMAND_FUNNEL_NOTE,
  DEMAND_ID_PREFIX,
  DEMAND_KPIS,
  DEMAND_OUTLET_LABEL,
  DEMAND_OUTLETS,
  DEMAND_PAGE_ITEMS,
  DEMAND_PAGINATION,
  DEMAND_REVIEW_STATE_OPTIONS,
  DEMAND_ROWS,
  DEMAND_SEARCH_PLACEHOLDER,
  DEMAND_SELECTED_ID,
  DEMAND_TREND_TABS,
  funnelShare,
  regressionAvailability,
  type DemandOutlet,
  type DemandRow,
} from '@/fixtures/demand';
import './DemandV2Page.css';

const LIVE_PAGE_SIZE = 10;
const OVERVIEW_PAGE_SIZE = 200;
const OVERVIEW_MAX_PAGES = 10;
const ROW_ORDER_STORAGE_KEY = 'dmd-list-order';
const ROW_LONG_PRESS_MS = 400;
const ROW_DRAG_CANCEL_PX = 8;

/** 产品模式比冻结页签多「业务验收」：交付／验收／归档都在这里，归档后才退出预警 */
const LIVE_DETAIL_TABS = [
  '基本信息',
  '评审信息',
  '分流与处理',
  '业务验收',
  '关联课程',
  '催办记录',
  '状态流转日志',
] as const;

/** 产品模式全量拉取（与 DemandDistribution 同策略：前端实时聚合，不建预聚合） */
async function loadAllDemands(filter: DemandFilter): Promise<Demand[]> {
  const rows: Demand[] = [];
  for (let page = 1; page <= OVERVIEW_MAX_PAGES; page += 1) {
    const result = await demandApi.page(filter, page, OVERVIEW_PAGE_SIZE);
    rows.push(...result.records);
    if (rows.length >= result.total || result.records.length === 0) break;
  }
  return rows;
}

function shareOf(value: number, total: number): string {
  return situationShare(value, total);
}

/** 列表行：fixture 行 + 可选后端主键（产品模式接接口时才有） */
interface DemandRowView extends DemandRow {
  liveId?: number;
  deliveryMark?: string | null;
  solutionState?: string | null;
  devState?: string | null;
}

/** 三张态势图只读这几个字段，接口行与设计稿行都能喂进来 */
interface SituationRow {
  reviewState?: string | null;
  solutionState?: string | null;
  devState?: string | null;
  outlet?: string | null;
  currentState?: string | null;
  currentProcessState?: string | null;
}

interface FilterState {
  keyword: string;
  domain: string;
  reviewState: string;
  outlet: string;
  owner: string;
  light: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  keyword: '',
  domain: '',
  reviewState: '',
  outlet: '',
  owner: '',
  light: '',
  dateFrom: '',
  dateTo: '',
};

function formatCount(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('en-US');
}

/** 产品模式按真实总页数画页码，当前页附近可点；回归仍用冻结的 127 页条 */
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

function readStoredRowOrder(): string[] {
  try {
    const raw = sessionStorage.getItem(ROW_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function mergeRowOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const next: T[] = [];
  const used = new Set<string>();
  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    next.push(item);
    used.add(id);
  }
  for (const item of items) {
    if (!used.has(item.id)) next.push(item);
  }
  return next;
}

function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

interface DemandV2ContextValue {
  regression: boolean;
  useMock: boolean;
  rows: DemandRowView[];
  total: number;
  pageNum: number;
  pageSize: number;
  pageItems: Array<number | null>;
  setPageNum: (page: number) => void;
  listMaximized: boolean;
  setListMaximized: (open: boolean) => void;
  kpis: ReadonlyArray<{ id: string; label: string; value: string; delta: string }>;
  domainBars: DomainBarItem[];
  funnelItems: FunnelItem[];
  funnelTotal: number;
  reviewFunnel: FunnelItem[];
  solutionFunnel: FunnelItem[];
  devFunnel: FunnelItem[];
  selectedId: string;
  selected: DemandRowView | undefined;
  liveDemand: Demand | undefined;
  pageDemands: Demand[];
  runCloseLoop: (demand: Demand) => void;
  closeLoopPendingId: number | null;
  archivedStates: readonly string[];
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  selectRow: (row: DemandRowView) => void;
  openDetail: (row: DemandRowView) => void;
  creating: boolean;
  setCreating: (open: boolean) => void;
  editing: boolean;
  setEditing: (open: boolean) => void;
  activeTab: (typeof LIVE_DETAIL_TABS)[number];
  setActiveTab: (tab: (typeof LIVE_DETAIL_TABS)[number]) => void;
  detailOpen: boolean;
  setDetailOpen: (open: boolean) => void;
  descExpanded: boolean;
  setDescExpanded: (open: boolean) => void;
  trendTabId: (typeof DEMAND_TREND_TABS)[number]['id'];
  setTrendTabId: (id: (typeof DEMAND_TREND_TABS)[number]['id']) => void;
}

const DemandV2Context = createContext<DemandV2ContextValue | null>(null);

function useDemandV2(): DemandV2ContextValue {
  const ctx = useContext(DemandV2Context);
  if (!ctx) {
    throw new Error('DemandV2 子树必须包在 DemandV2Page 内');
  }
  return ctx;
}

function outletKey(outlet: string | null | undefined): DemandOutlet | null {
  if (!outlet) return null;
  if (outlet === DEMAND_OUTLETS.REJECT.value || outlet.includes('驳回')) return 'REJECT';
  if (outlet === DEMAND_OUTLETS.SOLUTION.value || outlet.includes('解决方案')) return 'SOLUTION';
  if (outlet === DEMAND_OUTLETS.DEVELOP.value || outlet.includes('需求开发')) return 'DEVELOP';
  return null;
}

function mapLight(light: string): DemandRow['light'] {
  if (light === 'BLUE' || light === 'YELLOW' || light === 'RED' || light === 'NONE') return light;
  return 'NONE';
}

/** 与新建需求表单同一套字段，详情「基本信息」按此展示，避免登记能填、详情看不见。 */
function demandRegisterFields(row: {
  id: string;
  domain: string;
  proposer: string;
  proposedDate?: string | null;
  expectedDate?: string | null;
  owner: string;
  priority?: string | null;
  demandSource?: string | null;
  demandType?: string | null;
  businessBackground?: string | null;
  roiAnalysis?: string | null;
  remark?: string | null;
  proposerDept?: string | null;
}): Array<{ label: string; value: string | null | undefined }> {
  return [
    { label: '需求ID', value: row.id },
    { label: '需求所属领域', value: row.domain },
    { label: '需求提出人', value: row.proposer },
    { label: '提出人部门', value: row.proposerDept },
    { label: '需求提出时间', value: row.proposedDate },
    { label: '预计开发完成时间', value: row.expectedDate },
    { label: '需求负责人', value: row.owner },
    { label: '需求优先级', value: row.priority },
    { label: '需求来源', value: row.demandSource },
    { label: '需求类型', value: row.demandType },
    { label: '业务背景', value: row.businessBackground },
    { label: 'ROI分析', value: row.roiAnalysis },
    { label: '备注', value: row.remark },
  ];
}

function mapDemandToRow(demand: Demand, domainLabel?: string): DemandRowView {
  return {
    id: demand.demandNo,
    liveId: demand.id,
    name: demand.demandName,
    domain: domainLabel || demand.domainCode,
    proposer: demand.proposerName ?? demand.proposerNo,
    owner: demand.ownerNames ?? demand.ownerName ?? demand.ownerNo,
    reviewState: demand.reviewState,
    outlet: outletKey(demand.outlet),
    currentState: demand.currentProcessState,
    solutionState: demand.solutionState,
    devState: demand.devState,
    expectedDate: demand.expectFinishDate,
    proposedDate: demand.proposedDate,
    priority: demand.priority ?? '',
    demandSource: demand.demandSource ?? '',
    demandType: demand.demandType ?? '',
    businessBackground: demand.businessBackground ?? '',
    roiAnalysis: demand.roiAnalysis ?? '',
    remark: demand.remark ?? '',
    description: demand.description,
    light: mapLight(demand.light),
    // 后端 lightReason 是中文「已逾期／状态停滞」，不是 OVERDUE／STALLED。
    // 映射失败再兜成逾期，停滞红灯会整列变成「逾期」。
    lightReason: demand.light === 'RED' ? redLightReasonOf(demand.lightReason) : undefined,
    stalledDays: demand.light === 'NONE' ? null : demand.lightDays,
    deliveryMark: demand.deliveryMark,
  };
}

interface DomainBarItem {
  domain: string;
  value: number;
}

interface FunnelItem {
  state: string;
  value: number;
}

function processStateOf(row: {
  currentState?: string | null;
  currentProcessState?: string | null;
}): string | null {
  return row.currentProcessState ?? row.currentState ?? null;
}

/**
 * KPI 卡与状态的对应关系。
 *
 * <p>卡片顺序由 V2.0 冻结（{@link DEMAND_KPIS}），但状态值<b>按下发数组的下标取</b>，
 * 不在这里手写状态名（纪律 STK-1）。下发顺序即后端 {@code DemandStateMachines} 的定义顺序：
 * 评审 [待评审, 评审中, 已评审]；开发 [已立项, 待开发, 开发中, 已上线, 优化中]。
 * 取法与 {@code demandMeta.useOutlets} 一致——元数据没到时下标取到 undefined，
 * 该卡计 0，而不是把另一个状态的数字显示上去。
 */
const KPI_STATE_SOURCE: Record<string, { field: 'review' | 'dev'; index: number }> = {
  pendingReview: { field: 'review', index: 0 },
  reviewing: { field: 'review', index: 1 },
  reviewed: { field: 'review', index: 2 },
  approved: { field: 'dev', index: 0 },
  // 「待开发」在下标 1，没有对应的 KPI 卡，所以开发中／已上线是 2 与 3
  developing: { field: 'dev', index: 2 },
  online: { field: 'dev', index: 3 },
};

function aggregateKpis(
  rows: Array<{
    reviewState: string;
    currentState?: string | null;
    currentProcessState?: string | null;
  }>,
  total: number,
  reviewStates: string[],
  devStates: string[],
) {
  return DEMAND_KPIS.map((kpi) => {
    if (kpi.id === 'total') {
      return { ...kpi, value: formatCount(total), delta: '—' };
    }
    const source = KPI_STATE_SOURCE[kpi.id];
    const state = source && (source.field === 'review' ? reviewStates : devStates)[source.index];
    const value = state
      ? rows.filter((row) =>
          source!.field === 'review' ? row.reviewState === state : processStateOf(row) === state,
        ).length
      : 0;
    return { ...kpi, value: formatCount(value), delta: '—' };
  });
}

function toApiFilter(filters: FilterState): DemandFilter {
  return {
    keyword: filters.keyword || null,
    domainCode: filters.domain || null,
    reviewState: filters.reviewState || null,
    outlet: filters.outlet || null,
    ownerNo: filters.owner || null,
    light: filters.light || null,
    expectFinishFrom: filters.dateFrom || null,
    expectFinishTo: filters.dateTo || null,
  };
}

function filterFixtureRows(rows: DemandRowView[], filters: FilterState): DemandRowView[] {
  const keyword = filters.keyword.trim().toLowerCase();
  return rows.filter((row) => {
    if (keyword) {
      const hay = `${row.id} ${row.name} ${row.proposer}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    if (filters.domain && row.domain !== filters.domain) return false;
    if (filters.reviewState && row.reviewState !== filters.reviewState) return false;
    if (filters.outlet) {
      const key = outletKey(filters.outlet);
      if (row.outlet !== key) return false;
    }
    if (filters.owner && row.owner !== filters.owner) return false;
    if (filters.light && row.light !== filters.light) return false;
    if (filters.dateFrom && row.expectedDate < filters.dateFrom) return false;
    if (filters.dateTo && row.expectedDate > filters.dateTo) return false;
    return true;
  });
}

function availabilityFor(row: DemandRowView | undefined, product: boolean): ActionAvailability {
  if (!row) return { allowedActions: [], blockedActions: [] };
  if (product) return PRODUCT_DEMAND_ACTION_AVAILABILITY;
  if (row.id === DEMAND_SELECTED_ID) return DEMAND_ACTION_AVAILABILITY;
  return regressionAvailability(row.reviewState);
}

function fieldsForRow(row: DemandRowView): typeof DEMAND_DETAIL_FIELDS {
  if (row.id === DEMAND_SELECTED_ID) return DEMAND_DETAIL_FIELDS;
  const outlet = row.outlet ? DEMAND_OUTLETS[row.outlet] : null;
  return [
    {
      label: DEMAND_OUTLET_LABEL,
      value: outlet?.value ?? null,
      hint: '两条处理出口各有一组处理状态，取值见「分流与处理」页签；驳回不再流转',
    },
    { label: '当前处理状态', value: row.currentState, tag: row.currentState !== null },
    { label: '预计完成时间', value: row.expectedDate },
    { label: '评审状态', value: row.reviewState, tag: true },
  ];
}

/**
 * P02 AI需求驾驶舱（《设计文档 V2.0》第 6 章）。
 *
 * <p>回归模式（{@code ?fixture=1}）冻结右侧 R7 详情栏几何。产品模式跟课程工作台同一套：
 * 列表通栏，单击选中、双击（或回车）弹出详情，避免常驻右栏挡住列表。
 */
export function DemandV2Page() {
  const regression = isRegressionMode();
  const fixture = usesFixtureData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const domainLabelOf = useDomainLabel();
  const machines = useMachines();
  const fieldEnums = useFieldEnums();
  const outlets = useOutlets();
  const pendingOutput = fieldEnums.data?.[FIELD_ENUM_KEYS.solutionPendingOutput]?.[0];
  const reviewStates =
    machines.data?.find(
      (item) => item.objectType === 'DEMAND' && item.stateField === DEMAND_STATE_FIELDS.review,
    )?.states ?? [];
  const solutionMachineStates =
    machines.data?.find(
      (item) => item.objectType === 'DEMAND' && item.stateField === DEMAND_STATE_FIELDS.solution,
    )?.states ?? [];
  const devStates =
    machines.data?.find(
      (item) => item.objectType === 'DEMAND' && item.stateField === DEMAND_STATE_FIELDS.dev,
    )?.states ?? [];
  const solutionStates = [pendingOutput, ...solutionMachineStates].filter(
    (item, index, all): item is string => Boolean(item) && all.indexOf(item) === index,
  );
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [pageNum, setPageNum] = useState(1);
  const [selectedId, setSelectedId] = useState(DEMAND_SELECTED_ID);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof LIVE_DETAIL_TABS)[number]>(
    DEMAND_DETAIL_ACTIVE_TAB,
  );
  const [detailOpen, setDetailOpen] = useState(regression);
  const [listMaximized, setListMaximized] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [trendTabId, setTrendTabId] =
    useState<(typeof DEMAND_TREND_TABS)[number]['id']>('domain');

  const domainNameOf = useCallback((code: string) => domainLabelOf(code) ?? code, [domainLabelOf]);

  const overview = useQuery({
    queryKey: ['demands', 'v2', 'overview', filters],
    queryFn: () => loadAllDemands(toApiFilter(filters)),
    enabled: !fixture,
  });

  const overviewRecords = overview.data ?? [];

  const liveRows = useMemo(
    () => overviewRecords.map((row) => mapDemandToRow(row, domainNameOf(row.domainCode))),
    [overviewRecords, domainNameOf],
  );

  /*
   * 有任意一条真实数据就走接口列表，不再用 8 条演示行垫底。
   * 想看设计稿那 8 行：URL 加 ?fixture=1。演示构建没有后端，与回归一样直接读冻数。
   */
  const useMock =
    fixture || overview.isError || (overview.isSuccess && overviewRecords.length === 0);

  const fixtureFiltered = useMemo(
    () => filterFixtureRows(DEMAND_ROWS, filters),
    [filters],
  );

  const total = regression
    ? DEMAND_PAGINATION.total
    : useMock
      ? fixtureFiltered.length
      : overviewRecords.length;

  const pageSize = regression ? DEMAND_PAGINATION.pageSize : LIVE_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePageNum = Math.min(pageNum, totalPages);
  const pageItems = regression ? DEMAND_PAGE_ITEMS : buildPageItems(totalPages, safePageNum);

  /*
   * 产品模式一次铺开全部需求，页码只负责把滚动条跳到该页第一条。
   * 回归仍按冻结分页切 8 行，避免打穿 p02。
   */
  const rows: DemandRowView[] = regression
    ? DEMAND_ROWS
    : useMock
      ? fixtureFiltered
      : liveRows;

  const overviewRows = overviewRecords;
  const kpis = useMemo(() => {
    if (regression || fixture) return DEMAND_KPIS;
    const rows = useMock ? fixtureFiltered : overviewRows;
    const count = useMock ? fixtureFiltered.length : total;
    return aggregateKpis(rows, count, reviewStates, devStates);
  }, [regression, fixture, useMock, fixtureFiltered, overviewRows, total, reviewStates, devStates]);

  /*
   * 下面两个只喂回归版式的四列分析区（RegressionAnalysisPanel）。
   * 产品模式渲染的是三张态势图，走 reviewFunnel／solutionFunnel／devFunnel，
   * 所以这里不对最多 2000 行的总览数据再做一轮聚合。
   */
  const domainBars = useMemo(
    () => (regression ? [...DEMAND_DOMAIN_BARS] : []),
    [regression],
  );

  const funnelItems = useMemo(
    () => (regression ? DEMAND_FUNNEL.map((item) => ({ ...item })) : []),
    [regression],
  );

  const funnelTotal = regression ? DEMAND_PAGINATION.total : Math.max(total, 1);

  const situationRows: readonly SituationRow[] = useMock ? fixtureFiltered : overviewRows;
  const reviewFunnel = useMemo(() => {
    const states =
      reviewStates.length > 0
        ? reviewStates
        : [...new Set(situationRows.map((row) => row.reviewState).filter((state): state is string => Boolean(state)))];
    return countByStates(situationRows, states, (row) => row.reviewState);
  }, [situationRows, reviewStates]);
  const solutionFunnel = useMemo(
    () =>
      countByStates(situationRows, solutionStates, (row) =>
        solutionBucketOf(row, pendingOutput, outlets.solution),
      ),
    [situationRows, solutionStates, pendingOutput, outlets.solution],
  );
  const devFunnel = useMemo(
    () => countByStates(situationRows, devStates, (row) => devStateOf(row, outlets.development)),
    [situationRows, devStates, outlets.development],
  );

  useEffect(() => {
    if (pageNum > totalPages) setPageNum(1);
  }, [pageNum, totalPages]);

  useEffect(() => {
    if (rows.length === 0) return;
    if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0]!.id);
    }
  }, [rows, selectedId]);

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  const liveDemandQ = useQuery({
    queryKey: ['demands', selected?.liveId, 'v2-detail'],
    queryFn: () => demandApi.detail(selected!.liveId!),
    enabled: !regression && selected?.liveId != null,
  });

  const archivedStates = useMemo(
    () =>
      machines.data?.find(
        (item) => item.objectType === 'DEMAND' && item.stateField === DEMAND_STATE_FIELDS.deliveryMark,
      )?.terminalStates ?? [],
    [machines.data],
  );

  const closeLoop = useDemandCloseLoop({
    onNeedAcceptance: (demand) => {
      setSelectedId(demand.demandNo);
      setDetailOpen(true);
      setActiveTab('业务验收');
    },
  });

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageNum(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPageNum(1);
  }, []);

  const selectRow = useCallback(
    (row: DemandRowView) => {
      setSelectedId(row.id);
      setDescExpanded(false);
      // 回归模式详情是常驻右栏，点行即换内容；产品模式单击只选中，双击才弹窗
      if (regression) {
        setDetailOpen(true);
        setActiveTab(DEMAND_DETAIL_ACTIVE_TAB);
      }
    },
    [regression],
  );

  const openDetail = useCallback((row: DemandRowView) => {
    setSelectedId(row.id);
    setDetailOpen(true);
    setActiveTab(DEMAND_DETAIL_ACTIVE_TAB);
    setDescExpanded(false);
  }, []);

  const ctx: DemandV2ContextValue = {
    regression,
    useMock,
    rows,
    total,
    pageNum: regression ? DEMAND_PAGINATION.pageNum : safePageNum,
    pageSize,
    pageItems,
    setPageNum,
    listMaximized: regression ? false : listMaximized,
    setListMaximized,
    kpis,
    domainBars,
    funnelItems,
    funnelTotal,
    reviewFunnel,
    solutionFunnel,
    devFunnel,
    selectedId: selected?.id ?? selectedId,
    selected,
    liveDemand: liveDemandQ.data,
    pageDemands: overviewRecords,
    runCloseLoop: closeLoop.run,
    closeLoopPendingId: closeLoop.pendingId,
    archivedStates,
    filters,
    setFilter,
    resetFilters,
    selectRow,
    openDetail,
    creating,
    setCreating,
    editing,
    setEditing,
    activeTab,
    setActiveTab,
    detailOpen,
    setDetailOpen,
    descExpanded,
    setDescExpanded,
    trendTabId,
    setTrendTabId,
  };

  return (
    <DemandV2Context.Provider value={ctx}>
      <div className="dmd v2-page">
        <KpiRow />
        <FilterBar />

        <div className="dmd-main" data-maximized={listMaximized && !regression}>
          <div className="dmd-left">
            <DemandTablePanel />
            {!(listMaximized && !regression) && <AnalysisPanel />}
          </div>
          {regression &&
            (detailOpen ? (
              <DetailPanel />
            ) : (
              <section className="panel dmd-detail" data-region="R7" aria-label="需求详情" />
            ))}
        </div>
      </div>

      {!regression && detailOpen && (
        <DemandDetailModal
          onClose={() => {
            setDetailOpen(false);
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && focused.closest('[data-testid="demand-row"]')) {
              focused.blur();
            }
          }}
        />
      )}

      <DemandFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          invalidateDemandGraph(queryClient);
          // 新建成功后跳业务详情深链（录入表单仍在业务页）
          navigate(`/demands/${id}`);
        }}
      />
      {liveDemandQ.data && (
        <DemandFormModal
          open={editing}
          demand={liveDemandQ.data}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            invalidateDemandGraph(queryClient);
          }}
        />
      )}
    </DemandV2Context.Provider>
  );
}

const KPI_ICONS: Record<string, LucideIcon> = {
  total: FileText,
  pendingReview: ClipboardCheck,
  reviewing: CircleDot,
  reviewed: Target,
  approved: BarChart3,
  developing: SlidersHorizontal,
  online: Rocket,
};

const KPI_TONES: Record<string, string> = {
  total: '#5B82FF',
  pendingReview: '#7C6CF0',
  reviewing: '#3974FA',
  reviewed: '#3FA9C9',
  approved: '#8B5CF6',
  developing: '#4E70DB',
  online: '#FF9A3E',
};

const DELTA_BASELINE_LABEL = '月度环比（较上月）';

function KpiRow() {
  const { kpis } = useDemandV2();
  return (
    <section className="dmd-kpis" data-region="R3" aria-label="需求指标概览">
      {kpis.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id] ?? FileText;
        const tone = KPI_TONES[kpi.id] ?? colorV2.brandAction;
        return (
          <article className="dmd-kpi" key={kpi.id} data-testid="demand-kpi" data-kpi={kpi.id}>
            <div className="dmd-kpi-top">
              <p className="dmd-kpi-label">{kpi.label}</p>
              <span
                className="dmd-kpi-plate"
                style={{ color: tone, background: `${tone}33` }}
                aria-hidden
              >
                <Icon size={16} strokeWidth={1.8} />
              </span>
            </div>
            <p className="dmd-kpi-value"><AnimatedNumber value={kpi.value} duration={520} /></p>
            <p className="dmd-kpi-foot">
              <span className="dmd-kpi-delta">{kpi.delta}</span>
              <span className="dmd-kpi-baseline">{DELTA_BASELINE_LABEL}</span>
            </p>
          </article>
        );
      })}
    </section>
  );
}

function FilterBar() {
  const { filters, setFilter, resetFilters, setCreating, regression, rows } =
    useDemandV2();
  const employees = useEmployees();
  const demandDomains = useDemandDomains();
  const liveReviewStates = useStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.review);
  const reviewStateOptions = regression
    ? [...DEMAND_REVIEW_STATE_OPTIONS]
    : liveReviewStates;

  const domainOptions = useMemo(() => {
    if (!regression) {
      return demandDomains.map((item) => ({
        value: item,
        label: item,
      }));
    }
    return [...new Set(DEMAND_ROWS.map((row) => row.domain))].map((item) => ({
      value: item,
      label: item,
    }));
  }, [regression, demandDomains]);

  const ownerOptions = useMemo(() => {
    if (!regression) {
      return (employees.data?.records ?? [])
        .filter((item) => item.personState === '在职')
        .map((item) => ({
          value: item.employeeNo,
          label: `${item.employeeName}（${item.employeeNo}）`,
        }));
    }
    return [...new Set([...DEMAND_ROWS, ...rows].map((row) => row.owner))].map((item) => ({
      value: item,
      label: item,
    }));
  }, [regression, employees.data, rows]);

  return (
    <section className="dmd-filters" data-region="R4" aria-label="需求筛选">
      <div className="dmd-search">
        <Search size={14} color={colorV2.textTertiary} aria-hidden />
        <input
          type="search"
          placeholder={DEMAND_SEARCH_PLACEHOLDER}
          aria-label="搜索需求"
          value={filters.keyword}
          onChange={(event) => setFilter('keyword', event.target.value)}
        />
      </div>

      {DEMAND_FILTERS.map((filter) => {
        if (filter.id === 'domain') {
          return (
            <FilterSelect
              key={filter.id}
              filterId={filter.id}
              label={filter.label}
              placeholder={filter.placeholder}
              value={filters.domain}
              onChange={(value) => setFilter('domain', value)}
              options={domainOptions}
            />
          );
        }
        if (filter.id === 'reviewState') {
          return (
            <FilterSelect
              key={filter.id}
              filterId={filter.id}
              label={filter.label}
              placeholder={filter.placeholder}
              value={filters.reviewState}
              onChange={(value) => setFilter('reviewState', value)}
              options={reviewStateOptions.map((item) => ({ value: item, label: item }))}
            />
          );
        }
        if (filter.id === 'outlet') {
          return (
            <FilterSelect
              key={filter.id}
              filterId={filter.id}
              label={filter.label}
              placeholder={filter.placeholder}
              value={filters.outlet}
              onChange={(value) => setFilter('outlet', value)}
              options={[
                { value: DEMAND_OUTLETS.SOLUTION.value, label: DEMAND_OUTLETS.SOLUTION.shortLabel },
                { value: DEMAND_OUTLETS.DEVELOP.value, label: DEMAND_OUTLETS.DEVELOP.shortLabel },
                ...(!regression
                  ? [{ value: DEMAND_OUTLETS.REJECT.value, label: DEMAND_OUTLETS.REJECT.shortLabel }]
                  : []),
              ]}
            />
          );
        }
        if (filter.id === 'owner') {
          return (
            <FilterSelect
              key={filter.id}
              filterId={filter.id}
              label={filter.label}
              placeholder={filter.placeholder}
              value={filters.owner}
              onChange={(value) => setFilter('owner', value)}
              options={ownerOptions}
            />
          );
        }
        return (
          <FilterSelect
            key={filter.id}
            filterId={filter.id}
            label={filter.label}
            placeholder={filter.placeholder}
            value={filters.light}
            onChange={(value) => setFilter('light', value)}
            options={[
              { value: 'BLUE', label: '蓝灯' },
              { value: 'YELLOW', label: '黄灯' },
              { value: 'RED', label: '红灯' },
              { value: 'NONE', label: '无灯' },
            ]}
          />
        );
      })}

      <span className="dmd-filter" data-testid="demand-daterange">
        <span className="dmd-filter-label">{DEMAND_DATE_RANGE.label}</span>
        {regression ? (
          <button className="dmd-control dmd-daterange" type="button" aria-label="日期区间">
            <span className="dmd-date">{DEMAND_DATE_RANGE.from}</span>
            <span className="dmd-date-sep" aria-hidden>
              ～
            </span>
            <span className="dmd-date">{DEMAND_DATE_RANGE.to}</span>
            <CalendarDays size={13} color={colorV2.textTertiary} aria-hidden />
          </button>
        ) : (
          <span className="dmd-control dmd-daterange">
            <input
              className="dmd-date-input"
              type="date"
              aria-label="预计完成起"
              value={filters.dateFrom}
              onChange={(event) => setFilter('dateFrom', event.target.value)}
            />
            <span className="dmd-date-sep" aria-hidden>
              ～
            </span>
            <input
              className="dmd-date-input"
              type="date"
              aria-label="预计完成止"
              value={filters.dateTo}
              onChange={(event) => setFilter('dateTo', event.target.value)}
            />
            <CalendarDays size={13} color={colorV2.textTertiary} aria-hidden />
          </span>
        )}
      </span>

      {regression && (
        <button className="dmd-more" type="button" aria-pressed={false}>
          <SlidersHorizontal size={14} aria-hidden />
          更多筛选
        </button>
      )}

      <button className="dmd-reset" type="button" onClick={resetFilters}>
        <RotateCcw size={13} aria-hidden />
        重置
      </button>

      <button className="dmd-create" type="button" onClick={() => setCreating(true)}>
        新建需求
      </button>
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

function FilterSelect({
  filterId,
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  filterId: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const { regression } = useDemandV2();
  const selectRef = useRef<HTMLSelectElement>(null);
  const [controlWidth, setControlWidth] = useState<number | null>(null);
  const optionLabels = useMemo(
    () => [placeholder, ...options.map((item) => item.label)],
    [placeholder, options],
  );

  useLayoutEffect(() => {
    if (regression) return;
    const el = selectRef.current;
    if (!el) return;
    setControlWidth(measureSelectWidth(el, optionLabels));
  }, [regression, optionLabels]);

  return (
    <span className="dmd-filter" data-testid="demand-filter" data-filter={filterId}>
      <span className="dmd-filter-label">{label}</span>
      {regression ? (
        <button className="dmd-control" type="button" aria-label={label}>
          <span className="dmd-filter-value">{placeholder}</span>
          <ChevronDown size={14} color={colorV2.textTertiary} aria-hidden />
        </button>
      ) : (
        <select
          ref={selectRef}
          className="dmd-control"
          aria-label={label}
          value={value}
          data-empty={value === '' ? 'true' : 'false'}
          style={controlWidth == null ? undefined : { width: controlWidth }}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

/**
 * 十一列合计 884 = R5 区域宽。原操作列 35px 并入需求ID（左边距）与名称列。
 * 改动需同步 tests/visual/p02-demand.spec.ts。
 */
/* 名称列需 ≥145：最长名「企业培训报表自定义导出」约 143px（见 p02 L2） */
const DEMAND_COLUMN_WIDTHS = [100, 150, 75, 60, 60, 78, 96, 78, 88, 46, 53];

/**
 * 产品模式表头「剩余/逾期」比「停滞」长，从名称列匀 27px。
 * 回归模式仍用 DEMAND_COLUMN_WIDTHS（合计 884），避免打穿 p02。
 */
const PRODUCT_COLUMN_WIDTHS = [100, 123, 75, 60, 60, 78, 96, 78, 88, 46, 80];

/** 产品模式多一列「闭环」；回归模式保持十一列 884，避免打穿 p02 视觉门禁 */
const LIVE_CLOSE_LOOP_COLUMN_WIDTH = 52;
const LIVE_COLUMN_WIDTHS = [...PRODUCT_COLUMN_WIDTHS, LIVE_CLOSE_LOOP_COLUMN_WIDTH];

/** 产品模式固定有「开发优先级」；插在负责人后。回归不加，避免打穿 p02。 */
const PRIORITY_COLUMN_WIDTH = 80;
const PRIORITY_COLUMN_INDEX = 5;

function withPriorityColumn(widths: number[], show: boolean): number[] {
  if (!show) return widths;
  return [...widths.slice(0, PRIORITY_COLUMN_INDEX), PRIORITY_COLUMN_WIDTH, ...widths.slice(PRIORITY_COLUMN_INDEX)];
}

function priorityShort(priority: string | null | undefined): string | null {
  if (!priority) return null;
  const code = priority.match(/^P[0-2]/);
  return code?.[0] ?? priority;
}

function PagerJump({
  pageNum,
  totalPages,
  disabled,
  onJump,
}: {
  pageNum: number;
  totalPages: number;
  disabled: boolean;
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
    <span className="dmd-pager-jump">
      跳至
      <input
        className="dmd-pager-input"
        value={draft}
        disabled={disabled}
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

function DemandTablePanel() {
  const {
    rows,
    total,
    selectedId,
    selectRow,
    openDetail,
    pageNum,
    pageSize,
    pageItems,
    setPageNum,
    regression,
    useMock,
    pageDemands,
    runCloseLoop,
    closeLoopPendingId,
    archivedStates,
    listMaximized,
    setListMaximized,
    filters,
  } = useDemandV2();
  const isOperator = useIsOperator();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPage = !regression;
  const showCloseLoop = !regression && !useMock && isOperator;
  const showPriority = !regression;
  const columnWidths = withPriorityColumn(
    regression ? DEMAND_COLUMN_WIDTHS : showCloseLoop ? LIVE_COLUMN_WIDTHS : PRODUCT_COLUMN_WIDTHS,
    showPriority,
  );
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const [rowOrder, setRowOrder] = useState<string[]>(() => (regression ? [] : readStoredRowOrder()));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    rowId: string;
    fromIndex: number;
    startX: number;
    startY: number;
    timer: number | null;
    armed: boolean;
  } | null>(null);

  const displayRows = regression ? rows : mergeRowOrder(rows, rowOrder);

  const persistOrder = useCallback((order: string[]) => {
    setRowOrder(order);
    try {
      sessionStorage.setItem(ROW_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {
      /* 隐私模式写不进 sessionStorage 也不挡换位 */
    }
  }, []);

  const indexAtPoint = useCallback((clientY: number) => {
    const container = scrollRef.current;
    if (!container) return 0;
    const rowEls = container.querySelectorAll<HTMLElement>('[data-row-index]');
    if (rowEls.length === 0) return 0;
    for (let i = 0; i < rowEls.length; i += 1) {
      const rect = rowEls[i]!.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rowEls.length - 1;
  }, []);

  const autoScroll = useCallback((clientY: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const edge = 36;
    if (clientY < rect.top + edge) {
      container.scrollTop -= 12;
    } else if (clientY > rect.bottom - edge) {
      container.scrollTop += 12;
    }
  }, []);

  const endDrag = useCallback(
    (clientY: number | null) => {
      const drag = dragRef.current;
      if (drag?.timer != null) window.clearTimeout(drag.timer);
      if (drag?.armed && clientY != null) {
        const to = indexAtPoint(clientY);
        if (to !== drag.fromIndex) {
          persistOrder(moveIndex(displayRows.map((row) => row.id), drag.fromIndex, to));
        }
        suppressClickRef.current = true;
      }
      dragRef.current = null;
      setDraggingId(null);
      setDropIndex(null);
    },
    [displayRows, indexAtPoint, persistOrder],
  );

  useEffect(() => {
    if (regression) return undefined;
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.armed) {
        if (dist > ROW_DRAG_CANCEL_PX && drag.timer != null) {
          window.clearTimeout(drag.timer);
          drag.timer = null;
          dragRef.current = null;
        }
        return;
      }
      event.preventDefault();
      autoScroll(event.clientY);
      setDropIndex(indexAtPoint(event.clientY));
    };
    const onUp = (event: PointerEvent) => {
      if (!dragRef.current) return;
      endDrag(event.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [autoScroll, endDrag, indexAtPoint, regression]);

  const onRowPointerDown = (event: ReactPointerEvent<HTMLTableSectionElement>) => {
    if (regression || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button')) return;
    const tr = target.closest('[data-testid="demand-row"]');
    if (!(tr instanceof HTMLElement)) return;
    const rowId = tr.dataset.demand;
    const fromIndex = Number(tr.dataset.rowIndex);
    if (!rowId || !Number.isFinite(fromIndex)) return;
    const timer = window.setTimeout(() => {
      const current = dragRef.current;
      if (!current || current.timer !== timer) return;
      current.armed = true;
      current.timer = null;
      setDraggingId(current.rowId);
      setDropIndex(current.fromIndex);
    }, ROW_LONG_PRESS_MS);
    dragRef.current = {
      pointerId: event.pointerId,
      rowId,
      fromIndex,
      startX: event.clientX,
      startY: event.clientY,
      timer,
      armed: false,
    };
  };

  const scrollToRowIndex = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const row = container.querySelector(`[data-row-index="${index}"]`);
    if (!(row instanceof HTMLElement)) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const thead = container.querySelector('thead');
    const theadH = thead?.getBoundingClientRect().height ?? 0;
    const nextTop =
      row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - theadH;
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  };

  const goPage = (page: number) => {
    if (!canPage) return;
    const next = Math.min(totalPages, Math.max(1, page));
    setPageNum(next);
    scrollToRowIndex((next - 1) * pageSize);
    setShowBackTop(next > 1);
  };

  const syncPageFromScroll = (container: HTMLDivElement) => {
    const thead = container.querySelector('thead');
    const probeY = container.getBoundingClientRect().top + (thead?.getBoundingClientRect().height ?? 0) + 1;
    const rowEls = container.querySelectorAll<HTMLElement>('[data-row-index]');
    if (rowEls.length === 0) return;
    let lo = 0;
    let hi = rowEls.length - 1;
    let index = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rowEls[mid]!.getBoundingClientRect().bottom > probeY) {
        index = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    const nextPage = Math.min(totalPages, Math.floor(index / pageSize) + 1);
    if (nextPage !== pageNum) setPageNum(nextPage);
  };

  useEffect(() => {
    if (regression) return;
    scrollRef.current?.scrollTo({ top: 0 });
    setShowBackTop(false);
  }, [filters, regression]);

  return (
    <section className="panel dmd-table-panel" data-region="R5" aria-label="需求列表">
      <div className="panel-head">
        <h2 className="panel-title">需求列表</h2>
        <span className="dmd-list-count">共 {total.toLocaleString('en-US')} 条</span>
        {!regression && (
          <button
            className="dmd-panel-close"
            type="button"
            aria-label={listMaximized ? '还原需求列表' : '最大化需求列表'}
            title={listMaximized ? '还原' : '最大化'}
            onClick={() => setListMaximized(!listMaximized)}
          >
            {listMaximized ? (
              <Minimize2 size={14} color={colorV2.textTertiary} aria-hidden />
            ) : (
              <Maximize2 size={14} color={colorV2.textTertiary} aria-hidden />
            )}
          </button>
        )}
      </div>

      <div
        className="dmd-table-scroll"
        ref={scrollRef}
        data-reordering={draggingId != null}
        onScroll={(event) => {
          const container = event.currentTarget;
          setShowBackTop(container.scrollTop > 40);
          if (!regression && draggingId == null) syncPageFromScroll(container);
        }}
      >
        <table className="dmd-table">
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={{ width: `${((width / tableWidth) * 100).toFixed(4)}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>需求ID</th>
              <th>需求名称</th>
              <th>领域</th>
              <th>提出人</th>
              <th>负责人</th>
              {showPriority && <th>开发优先级</th>}
              <th>评审状态</th>
              <th>{DEMAND_OUTLET_LABEL}</th>
              <th>处理状态</th>
              <th>预计完成</th>
              <th>{regression ? '灯色' : '预警'}</th>
              <th>{regression ? '停滞' : '剩余/逾期'}</th>
              {showCloseLoop && <th>闭环</th>}
            </tr>
          </thead>
          <tbody
            onPointerDown={onRowPointerDown}
            onContextMenu={(event) => {
              if (draggingId != null) event.preventDefault();
            }}
          >
            {displayRows.map((row, index) => (
              <DemandTableRow
                key={row.id}
                row={row}
                rowIndex={index}
                selected={row.id === selectedId}
                dragging={row.id === draggingId}
                dropHint={
                  draggingId != null && dropIndex === index && row.id !== draggingId
                    ? 'before'
                    : undefined
                }
                suppressClickRef={suppressClickRef}
                onSelect={() => selectRow(row)}
                onOpen={() => openDetail(row)}
                liveDemand={pageDemands.find((item) => item.id === row.liveId)}
                showPriority={showPriority}
                showCloseLoop={showCloseLoop}
                closeLoopPending={row.liveId != null && closeLoopPendingId === row.liveId}
                archived={
                  row.deliveryMark != null && archivedStates.includes(row.deliveryMark)
                }
                onCloseLoop={runCloseLoop}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showBackTop && (
        <button
          className="dmd-back-top"
          type="button"
          onClick={() => {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            if (!regression) setPageNum(1);
            setShowBackTop(false);
          }}
        >
          回到顶部
        </button>
      )}

      <div className="dmd-pager">
        <span className="dmd-pager-total">共 {total.toLocaleString('en-US')} 条</span>
        <button className="dmd-pager-size" type="button">
          {pageSize} 条/页
          <ChevronDown size={13} color={colorV2.textTertiary} aria-hidden />
        </button>
        <span className="dmd-pager-pages">
          <button
            className="dmd-pager-step"
            type="button"
            aria-label="上一页"
            disabled={!canPage || pageNum === 1}
            onClick={() => goPage(Math.max(1, pageNum - 1))}
          >
            <ChevronLeft size={13} aria-hidden />
          </button>
          {pageItems.map((item, index) =>
            item === null ? (
              <span className="dmd-pager-gap" key={`gap-${index}`} aria-hidden>
                …
              </span>
            ) : (
              <button
                className="dmd-pager-page"
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
            className="dmd-pager-step"
            type="button"
            aria-label="下一页"
            disabled={!canPage || pageNum >= totalPages}
            onClick={() => goPage(Math.min(totalPages, pageNum + 1))}
          >
            <ChevronRight size={13} aria-hidden />
          </button>
        </span>
        <PagerJump
          pageNum={pageNum}
          totalPages={totalPages}
          disabled={!canPage}
          onJump={goPage}
        />
      </div>
    </section>
  );
}

function DemandTableRow({
  row,
  rowIndex,
  selected,
  dragging,
  dropHint,
  suppressClickRef,
  onSelect,
  onOpen,
  liveDemand,
  showPriority,
  showCloseLoop,
  closeLoopPending,
  archived,
  onCloseLoop,
}: {
  row: DemandRowView;
  rowIndex: number;
  selected: boolean;
  dragging?: boolean;
  dropHint?: 'before' | 'after';
  suppressClickRef?: { current: boolean };
  onSelect: () => void;
  onOpen: () => void;
  liveDemand?: Demand;
  showPriority?: boolean;
  showCloseLoop?: boolean;
  closeLoopPending?: boolean;
  archived?: boolean;
  onCloseLoop?: (demand: Demand) => void;
}) {
  const outlet = row.outlet === null ? null : DEMAND_OUTLETS[row.outlet];

  return (
    <tr
      data-testid="demand-row"
      data-row-index={rowIndex}
      data-demand={row.id}
      data-selected={selected}
      data-dragging={dragging || undefined}
      data-drop={dropHint}
      aria-selected={selected}
      tabIndex={0}
      title={suppressClickRef ? '长按拖动调整顺序，双击查看详情' : '双击查看需求详情'}
      onClick={() => {
        if (suppressClickRef?.current) {
          suppressClickRef.current = false;
          return;
        }
        onSelect();
      }}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        onOpen();
      }}
    >
      <td className="dmd-cell-id" title={row.id}>
        {row.id.startsWith(DEMAND_ID_PREFIX) ? row.id.slice(DEMAND_ID_PREFIX.length) : row.id}
      </td>
      <td className="dmd-cell-name" title={row.name}>
        {row.name}
      </td>
      <td>{row.domain}</td>
      <td>{row.proposer}</td>
      <td>{row.owner}</td>
      {showPriority && (
        <td className="dmd-cell-priority" title={row.priority || undefined}>
          {priorityShort(row.priority) ?? <Blank />}
        </td>
      )}
      <td>
        <ReviewStateTag state={row.reviewState} />
      </td>
      <td title={outlet?.value}>{outlet === null ? <Blank /> : outlet.shortLabel}</td>
      <td>{row.currentState ?? <Blank />}</td>
      <td className="dmd-cell-date">{row.expectedDate}</td>
      <td>
        {row.light === 'NONE' ? (
          <WarningLight color="NONE" short />
        ) : row.light === 'RED' ? (
          <WarningLight
            color="RED"
            reason={row.lightReason ?? 'STALLED'}
            daysShownInSeparateColumn
            short
          />
        ) : (
          <WarningLight color={row.light} daysShownInSeparateColumn short />
        )}
      </td>
      <td className="dmd-cell-stalled">{row.stalledDays === null ? <Blank /> : `${row.stalledDays} 天`}</td>
      {showCloseLoop && (
        <td>
          <button
            className="dmd-close-loop"
            type="button"
            data-testid="demand-close-loop"
            disabled={archived || liveDemand == null || closeLoopPending}
            onClick={(event) => {
              event.stopPropagation();
              if (liveDemand) onCloseLoop?.(liveDemand);
            }}
          >
            {archived ? '已闭环' : closeLoopPending ? '…' : '闭环'}
          </button>
        </td>
      )}
    </tr>
  );
}

function ReviewStateTag({ state }: { state: string }) {
  return (
    <span className="dmd-state-tag" data-state={state} data-testid="demand-review-state">
      <span className="dmd-state-dot" aria-hidden />
      {state}
    </span>
  );
}

function Blank() {
  return <span className="dmd-blank">—</span>;
}

const DEMAND_FUNNEL_COLORS = ['#9DB5FF', '#87A2FF', '#7191FF', '#5B82FF', '#4E70DB', '#3E5AB0'];

type SituationChartKind = 'donut' | 'hbar' | 'bar';

/**
 * 产品模式三张态势图：按数据语义各用一种图，不再三张都画横条。
 *
 * <ul>
 *   <li>评审状态：每条需求必有一态，是全集的构成 → 环形图</li>
 *   <li>解决方案：出口三态条数对比，状态名横着读 → 条形图</li>
 *   <li>开发状态：五个工位上各坐多少条，比存量 → 柱状图</li>
 * </ul>
 *
 * 数量与占比同时写在图例里，图表不是唯一信息载体。
 */
function SituationChart({
  title,
  items,
  kind,
}: {
  title: string;
  items: FunnelItem[];
  kind: SituationChartKind;
}) {
  const total = sliceTotal(items);
  const option = useMemo<EChartsOption>(() => situationChartOption(kind, items), [kind, items]);
  const caption = items.map((item) => `${item.state} ${item.value}，占 ${shareOf(item.value, total)}`).join('；');

  return (
    <article className="dmd-situation" aria-label={`${title}：${caption}`}>
      <h2 className="panel-title dmd-analysis-title">{title}</h2>
      {items.length === 0 ? (
        <p className="dmd-situation-empty">还没有可统计的数据</p>
      ) : (
        <>
          <div className="dmd-situation-chart" data-kind={kind}>
            <Chart option={option} height="100%" ariaLabel={caption} />
            {kind === 'donut' && (
              <div className="dmd-situation-donut-center" aria-hidden>
                <strong>{total}</strong>
                <span>条</span>
              </div>
            )}
          </div>
          <ul className="dmd-situation-legend">
            {items.map((item, index) => (
              <li className="dmd-situation-row" key={item.state} data-testid="demand-situation-row">
                <span
                  className="dmd-situation-swatch"
                  style={{ background: situationPalette(items.length)[index] ?? DEMAND_FUNNEL_COLORS[0] }}
                  aria-hidden
                />
                <span className="dmd-situation-name">{item.state}</span>
                <span className="dmd-situation-metrics">
                  <span className="dmd-situation-value">{item.value}</span>
                  <span className="dmd-situation-share">{shareOf(item.value, total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function situationPalette(count: number): string[] {
  if (count <= 3) return ['#9DB5FF', '#5B82FF', '#4E70DB'];
  return DEMAND_FUNNEL_COLORS;
}

function situationChartOption(kind: SituationChartKind, items: FunnelItem[]): EChartsOption {
  const palette = situationPalette(items.length);
  const data = items.map((item, index) => ({
    name: item.state,
    value: item.value,
    itemStyle: { color: palette[index] ?? palette[0] },
  }));

  if (kind === 'donut') {
    return {
      tooltip: { trigger: 'item', formatter: '{b}：{c}（{d}%）' },
      series: [
        {
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          data,
        },
      ],
    };
  }

  if (kind === 'hbar') {
    const xMax = Math.max(1, ...items.map((item) => item.value));
    const step = xMax <= 4 ? 1 : xMax <= 10 ? 2 : 5;
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 0, right: 28, top: 4, bottom: 0, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(xMax / step) * step,
        minInterval: 1,
        axisLabel: { fontSize: 10, color: colorV2.textTertiary },
        splitLine: { lineStyle: { color: colorV2.borderLight } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: items.map((item) => item.state),
        axisLabel: { fontSize: 11, color: colorV2.textSecondary },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: data.map((item) => ({ value: item.value, itemStyle: item.itemStyle })),
          barWidth: 14,
          itemStyle: { borderRadius: [0, 3, 3, 0] },
          label: { show: true, position: 'right', fontSize: 10, color: colorV2.textSecondary },
        },
      ],
    };
  }

  const yMax = Math.max(1, ...items.map((item) => item.value));
  const step = yMax <= 4 ? 1 : yMax <= 10 ? 2 : 5;
  const axisMax = Math.ceil(yMax / step) * step;

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 0, right: 4, top: 22, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: items.map((item) => item.state),
      axisLabel: {
        fontSize: 10,
        color: colorV2.textTertiary,
        interval: 0,
        margin: 6,
        lineHeight: 13,
        formatter: (value: string) =>
          value.length <= 3 ? value : `${value.slice(0, 2)}\n${value.slice(2)}`,
      },
      axisLine: { lineStyle: { color: colorV2.borderDefault } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: axisMax,
      minInterval: 1,
      axisLabel: { fontSize: 10, color: colorV2.textTertiary, margin: 4 },
      splitLine: { lineStyle: { color: colorV2.borderLight } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((item) => ({ value: item.value, itemStyle: item.itemStyle })),
        barWidth: 16,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 10, color: colorV2.textSecondary },
      },
    ],
  };
}

const TREND_TAB_ICONS: Record<(typeof DEMAND_TREND_TABS)[number]['id'], LucideIcon> = {
  domain: BarChart3,
  state: PieChart,
};

/**
 * R6 分析区。两种版式差得太远，拆成两个组件而不是在一个组件里提前 return——
 * 回归版要用五个 {@code useMemo} 拼 ECharts 配置，写在同一个组件里就成了条件调用 Hook：
 * 从 {@code ?fixture=1} 切回产品模式时组件不重新挂载，Hook 数量对不上，整页白屏。
 */
function AnalysisPanel() {
  const { regression } = useDemandV2();
  return regression ? <RegressionAnalysisPanel /> : <SituationAnalysisPanel />;
}

/** 产品模式：需求态势拆成评审／解决方案／开发三张，各自数量 + 占比 */
function SituationAnalysisPanel() {
  const { reviewFunnel, solutionFunnel, devFunnel } = useDemandV2();
  return (
    <section className="panel dmd-analysis dmd-analysis-split" data-region="R6" aria-label="需求分析">
      <SituationChart title="按需求评审状态" kind="donut" items={reviewFunnel} />
      <SituationChart title="按解决方案状态" kind="hbar" items={solutionFunnel} />
      <SituationChart title="按需求开发状态" kind="bar" items={devFunnel} />
    </section>
  );
}

/** 回归模式：《设计文档 V2.0》冻结的四列版式，几何参与像素比对，不要改 */
function RegressionAnalysisPanel() {
  const {
    domainBars,
    funnelItems,
    funnelTotal,
    trendTabId,
    setTrendTabId,
    regression,
    useMock,
  } = useDemandV2();
  const activeTrend =
    DEMAND_TREND_TABS.find((tab) => tab.id === trendTabId) ?? DEMAND_TREND_TABS[0]!;

  const chartBars = useMemo(() => {
    if (trendTabId === 'state') {
      return funnelItems.map((item) => ({ domain: item.state, value: item.value }));
    }
    return domainBars;
  }, [trendTabId, domainBars, funnelItems]);

  const yMax = useMemo(() => {
    const max = Math.max(0, ...chartBars.map((item) => item.value));
    if (max <= 0) return 10;
    const step = max <= 20 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : 50;
    return Math.ceil(max / step) * step;
  }, [chartBars]);

  const barOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 0, right: 0, top: 18, bottom: 0, containLabel: true },
      xAxis: {
        type: 'category',
        data: chartBars.map((item) => item.domain),
        axisLabel: {
          fontSize: 9,
          color: colorV2.textTertiary,
          interval: 0,
          margin: 6,
          lineHeight: 12,
          formatter: (value: string) =>
            value.length <= 2 ? value : `${value.slice(0, 2)}\n${value.slice(2)}`,
        },
        axisLine: { lineStyle: { color: colorV2.borderDefault } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax,
        interval: yMax / 4 || 1,
        axisLabel: { fontSize: 9, color: colorV2.textTertiary, margin: 6 },
        splitLine: { lineStyle: { color: colorV2.borderLight } },
      },
      series: [
        {
          type: 'bar',
          data: chartBars.map((item) => item.value),
          barWidth: 22,
          itemStyle: { color: colorV2.brandPrimary, borderRadius: [3, 3, 0, 0] },
          label: { show: true, position: 'top', fontSize: 10, color: colorV2.textSecondary },
        },
      ],
    }),
    [chartBars, yMax],
  );

  const funnelOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: 'funnel',
          left: 0,
          width: '100%',
          top: 2,
          bottom: 2,
          sort: 'none',
          gap: 2,
          minSize: '28%',
          maxSize: '100%',
          label: { show: false },
          data: funnelItems.map((item, index) => ({
            name: item.state,
            // 展示宽度用等差，真实数量走图例（与设计稿一致）
            value: funnelItems.length - index,
          })),
        },
      ],
      color: DEMAND_FUNNEL_COLORS,
    }),
    [funnelItems],
  );

  const legendShare = (value: number) =>
    regression ? funnelShare(value) : shareOf(value, funnelTotal);

  return (
    <section className="panel dmd-analysis" data-region="R6" aria-label="需求分析">
      <div className="dmd-analysis-col dmd-trend-rail">
        <h2 className="panel-title dmd-analysis-title">需求态势图</h2>
        <div className="dmd-trend-tabs" role="tablist" aria-label="统计口径">
          {DEMAND_TREND_TABS.map((tab) => {
            const active = tab.id === activeTrend.id;
            const Icon = TREND_TAB_ICONS[tab.id];
            return (
              <button
                className="dmd-trend-tab"
                key={tab.id}
                type="button"
                role="tab"
                data-testid="demand-trend-tab"
                data-active={active}
                aria-selected={active}
                onClick={() => setTrendTabId(tab.id)}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="dmd-analysis-col dmd-inset dmd-trend-inset">
        <p className="dmd-inset-title">{activeTrend.label}（个）</p>
        <div className="dmd-trend-chart">
          <Chart
            option={barOption}
            height="100%"
            ariaLabel={`${activeTrend.label}：${chartBars.map((item) => `${item.domain} ${item.value}`).join('、')}`}
          />
        </div>
      </div>

      <div className="dmd-analysis-col dmd-funnel">
        <div className="dmd-analysis-head">
          <h2 className="panel-title dmd-analysis-title">按需求评审状态分布</h2>
          <button className="dmd-analysis-select" type="button">
            全部
            <ChevronDown size={13} color={colorV2.textTertiary} aria-hidden />
          </button>
        </div>
        <div className="dmd-funnel-body">
          <div className="dmd-funnel-chart">
            <Chart
              option={funnelOption}
              height="100%"
              ariaLabel={`按需求评审状态分布：${funnelItems.map(
                (item) => `${item.state} ${item.value}，占 ${legendShare(item.value)}`,
              ).join('；')}`}
            />
          </div>
          <ul className="dmd-funnel-legend" aria-hidden>
            {funnelItems.map((item, index) => (
              <li className="dmd-funnel-legend-row" key={item.state} data-testid="demand-funnel-legend-row">
                <span className="dmd-funnel-dot" style={{ background: DEMAND_FUNNEL_COLORS[index] }} />
                <span className="dmd-funnel-name">{item.state}</span>
                <span className="dmd-funnel-metrics">
                  <span className="dmd-funnel-value">{item.value}</span>
                  <span className="dmd-funnel-share">({legendShare(item.value)})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="dmd-funnel-note">{DEMAND_FUNNEL_NOTE}</p>
      </div>

      <div className="dmd-analysis-col dmd-feed">
        <div className="dmd-inset dmd-feed-inset">
          <h2 className="panel-title dmd-analysis-title">需求动态</h2>
          <div className="dmd-feed-body">
            <img className="dmd-feed-illustration" src={ASSETS.A04} alt="" aria-hidden />
            <div className="dmd-feed-copy">
              <p className="dmd-feed-title">{DEMAND_FEED.title}</p>
              <p className="dmd-feed-caption">
                {regression || useMock
                  ? DEMAND_FEED.caption
                  : '一期不发消息；状态变更请看详情里的「状态流转日志」与催办台账'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 产品模式需求详情弹窗。双击列表行打开，Esc、遮罩、右上角关闭三条退出路径。
 *
 * <p>外壳直接用课程工作台的 {@code crs-modal}（1100 × 1200、居中），切页签不改外框。
 */
function DemandDetailModal({ onClose }: { onClose: () => void }) {
  const { selected } = useDemandV2();
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
        aria-label={selected ? `需求详情 · ${selected.name}` : '需求详情'}
        data-testid="demand-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="crs-modal-close" type="button" aria-label="关闭需求详情" onClick={requestClose}>
          <X size={16} aria-hidden />
        </button>
        <DetailPanel />
      </div>
    </div>
  );
}

function DetailPanel() {
  const {
    selected,
    liveDemand,
    useMock,
    regression,
    activeTab,
    setActiveTab,
    setDetailOpen,
    descExpanded,
    setDescExpanded,
    runCloseLoop,
    setEditing,
  } = useDemandV2();
  const isOperator = useIsOperator();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const startReview = useMutation({
    mutationFn: async () => {
      if (!liveDemand) throw new Error('无业务需求');
      return transitionApi.transit(DEMAND_OBJECT_TYPE, liveDemand.id, {
        stateField: '需求评审状态',
        action: 'START_REVIEW',
        version: liveDemand.version,
      });
    },
    onSuccess: () => {
      message.success('已开始评审');
      invalidateDemandGraph(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '开始评审失败'),
  });

  const urge = useMutation({
    mutationFn: async (force?: boolean) => {
      if (!liveDemand) throw new Error('无业务需求');
      return escalationsApi.mark({
        objectType: 'DEMAND',
        objectId: liveDemand.id,
        objectName: liveDemand.demandName,
        ownerNo: liveDemand.ownerNo,
        ownerName: liveDemand.ownerName,
        escalateType: '停滞',
        processNode: liveDemand.reviewState,
        light: liveDemand.light,
        source: '运营手动',
        content: `请关注需求「${liveDemand.demandName}」的进展`,
        force,
      });
    },
    onSuccess: () => {
      message.success('已记入催办台账');
      void queryClient.invalidateQueries({ queryKey: ['escalations'] });
      if (liveDemand) {
        void queryClient.invalidateQueries({ queryKey: ['demands', liveDemand.id, 'escalations'] });
      }
    },
    onError: (e, force) => {
      if (e instanceof ApiError && e.code === 'URGE_TOO_FREQUENT') {
        modal.confirm({
          title: '确认再次记录？',
          content: e.message,
          okText: '仍要标记已催办',
          onOk: () => urge.mutateAsync(true),
        });
        return;
      }
      message.error(e instanceof ApiError ? e.message : '催办记录失败');
      void force;
    },
  });

  if (!selected) {
    return (
      <section className="panel dmd-detail" data-region="R7" aria-label="需求详情">
        <p className="dmd-detail-empty">请选择左侧列表中的一条需求</p>
      </section>
    );
  }

  const showFixtureDetail = useMock || liveDemand === undefined;
  const people =
    selected.id === DEMAND_SELECTED_ID
      ? DEMAND_DETAIL_PEOPLE
      : ([
          { role: '当前负责人', name: selected.owner, title: '负责人' },
          { role: '提出人', name: selected.proposer, title: '提出人' },
        ] as const);
  const meta =
    selected.id === DEMAND_SELECTED_ID
      ? DEMAND_DETAIL_META
      : ([
          { label: '所属领域', value: selected.domain, tag: true },
          { label: '预计完成', value: selected.expectedDate, tag: false },
        ] as const);
  const description =
    selected.description
    || (selected.id === DEMAND_SELECTED_ID ? DEMAND_DESCRIPTION : undefined)
    || liveDemand?.description
    || '（演示数据未附带完整描述。接入业务数据后此处显示需求描述。）';
  const detailFields = fieldsForRow(selected);

  function onAction(action: string) {
    if (action === '修改需求信息') {
      if (liveDemand) {
        setEditing(true);
      } else {
        message.info('演示数据无法保存，请先「新建需求」后再编辑');
      }
      return;
    }
    if (action === '关联课程') {
      setActiveTab('关联课程');
      return;
    }
    if (action === '录入开发状态') {
      setActiveTab('分流与处理');
      return;
    }
    if (action === '录入评审结论') {
      setActiveTab('评审信息');
      if (showFixtureDetail) {
        message.info('请切换到「评审信息」页签录入结论；演示数据请先新建真实需求');
      }
      return;
    }
    if (action === '开始评审') {
      if (liveDemand) {
        startReview.mutate();
      } else {
        message.info('演示数据无法推进状态机，请先「新建需求」或打开业务详情');
      }
      return;
    }
    if (action === '一键催办') {
      if (liveDemand) {
        urge.mutate(undefined);
      } else {
        navigate('/escalations');
      }
      return;
    }
    if (action === '闭环') {
      if (liveDemand) {
        void runCloseLoop(liveDemand);
      }
    }
  }

  const detailTabs = showFixtureDetail ? DEMAND_DETAIL_TABS : LIVE_DETAIL_TABS;

  return (
    <section className="panel dmd-detail" data-region="R7" aria-label="需求详情">
      <header className="dmd-detail-head">
        {regression && <p className="dmd-detail-id">{selected.id}</p>}
        <h2 className="dmd-detail-name">{selected.name}</h2>
        <ReviewStateTag state={selected.reviewState} />
        <button
          className="dmd-panel-close"
          type="button"
          aria-label="关闭需求详情"
          onClick={() => setDetailOpen(false)}
        >
          <X size={14} color={colorV2.textTertiary} aria-hidden />
        </button>
      </header>

      <nav className="dmd-tabs" aria-label="需求详情页签">
        {detailTabs.map((tab) => (
          <button
            className="dmd-tab"
            key={tab}
            type="button"
            data-testid="demand-tab"
            data-active={tab === activeTab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="dmd-detail-body">
        {!showFixtureDetail && liveDemand ? (
          <div className="dmd-detail-live">
            <LiveTabBody tab={activeTab} demand={liveDemand} />
          </div>
        ) : (
          <MockTabBody
            tab={activeTab}
            selected={selected}
            detailFields={detailFields}
            people={people}
            meta={meta}
            description={description}
            descExpanded={descExpanded}
            onToggleDesc={() => setDescExpanded(!descExpanded)}
            compact={regression}
          />
        )}
      </div>

      <footer className="dmd-detail-actions">
          <ActionGuard
          availability={availabilityFor(selected, !regression)}
          gap={space.xs}
          block={regression}
          actions={(regression ? DEMAND_ACTION_ORDER : PRODUCT_DEMAND_ACTION_ORDER).map((action) => ({
            action,
            type: action === '录入评审结论' ? ('primary' as const) : undefined,
            onClick: () => onAction(action),
          }))}
        />
        {!regression && liveDemand && isOperator && (
          <Button
            className="dmd-close-loop-footer"
            data-testid="demand-close-loop-footer"
            onClick={() => onAction('闭环')}
          >
            闭环
          </Button>
        )}
      </footer>
    </section>
  );
}

function BasicInfoHeading() {
  const { liveDemand, setEditing, regression } = useDemandV2();
  const isOperator = useIsOperator();
  const { message } = App.useApp();

  if (regression || !isOperator) {
    return <h3 className="dmd-detail-section">基本信息</h3>;
  }

  return (
    <div className="dmd-section-head">
      <h3 className="dmd-detail-section">基本信息</h3>
      <button
        className="dmd-edit-basic"
        type="button"
        onClick={() => {
          if (liveDemand) {
            setEditing(true);
            return;
          }
          message.info('演示数据无法保存，请先「新建需求」后再编辑基本信息');
        }}
      >
        <Pencil size={13} aria-hidden />
        编辑
      </button>
    </div>
  );
}

function LiveTabBody({ tab, demand }: { tab: (typeof LIVE_DETAIL_TABS)[number]; demand: Demand }) {
  if (tab === '基本信息') {
    return (
      <div className="dmd-live-stack">
        <section className="dmd-group">
          <BasicInfoHeading />
          <dl className="dmd-fields dmd-fields-register">
            {demandRegisterFields({
              id: demand.demandNo,
              domain: demand.domainCode,
              proposer: demand.proposerName ?? demand.proposerNo,
              proposerDept: demand.proposerDept,
              proposedDate: demand.proposedDate,
              expectedDate: demand.expectFinishDate,
              owner: demand.ownerNames ?? demand.ownerName ?? demand.ownerNo,
              priority: demand.priority,
              demandSource: demand.demandSource,
              demandType: demand.demandType,
              businessBackground: demand.businessBackground,
              roiAnalysis: demand.roiAnalysis,
              remark: demand.remark,
            }).map((field) => (
              <div className="dmd-field" key={field.label} data-testid="demand-field">
                <dt>
                  <Diamond size={12} color={colorV2.textPlaceholder} aria-hidden />
                  {field.label}
                </dt>
                <dd>{field.value ? field.value : <Blank />}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="dmd-group dmd-desc">
          <h3 className="dmd-detail-section">需求描述</h3>
          <p className="dmd-desc-text" data-expanded="true">{demand.description}</p>
        </section>
        <section className="dmd-group">
          <h3 className="dmd-detail-section">附件</h3>
          <DemandAttachments
            demandId={demand.id}
            refField={DEMAND_REF_FIELDS.extras}
            emptyHint="可上传图片、文档、视频等补充材料"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          />
        </section>
      </div>
    );
  }
  if (tab === '催办记录') {
    return (
      <div className="dmd-live-stack">
        <h3 className="dmd-detail-section">催办记录</h3>
        <DemandEscalationsTab demand={demand} />
      </div>
    );
  }
  if (tab === '状态流转日志') {
    return (
      <section className="dmd-group">
        <h3 className="dmd-detail-section">状态流转日志</h3>
        <DemandStateLogTab demandId={demand.id} />
      </section>
    );
  }
  return (
    <div className="dmd-live-stack">
      {tab === '评审信息' && <DemandReviewsTab demand={demand} />}
      {tab === '分流与处理' && <DemandOutletTab demand={demand} />}
      {tab === '业务验收' && <DemandAcceptanceTab demand={demand} />}
      {tab === '关联课程' && <DemandCoursesTab demand={demand} />}
    </div>
  );
}

function MockTabBody({
  tab,
  selected,
  detailFields,
  people,
  meta,
  description,
  descExpanded,
  onToggleDesc,
  compact,
}: {
  tab: (typeof LIVE_DETAIL_TABS)[number];
  selected: DemandRowView;
  detailFields: ReturnType<typeof fieldsForRow>;
  people: ReadonlyArray<{ role: string; name: string; title: string }>;
  meta: ReadonlyArray<{ label: string; value: string; tag?: boolean }>;
  description: string;
  descExpanded: boolean;
  onToggleDesc: () => void;
  /** 视觉回归冻结设计稿：两人卡片 + 短描述，正文必须一屏装下 */
  compact: boolean;
}) {
  if (tab === '基本信息') {
    if (!compact) {
      return (
        <section className="dmd-group">
          <BasicInfoHeading />
          <dl className="dmd-fields dmd-fields-register">
            {demandRegisterFields(selected)
              .filter((field) => field.label !== '提出人部门')
              .map((field) => (
                <div className="dmd-field" key={field.label} data-testid="demand-field">
                  <dt>
                    <Diamond size={12} color={colorV2.textPlaceholder} aria-hidden />
                    {field.label}
                  </dt>
                  <dd>{field.value ? field.value : <Blank />}</dd>
                </div>
              ))}
          </dl>
          <section className="dmd-group dmd-desc">
            <h3 className="dmd-detail-section">需求描述</h3>
            <p className="dmd-desc-text" data-expanded={descExpanded}>
              {description}
            </p>
            <button className="dmd-desc-more" type="button" onClick={onToggleDesc}>
              {descExpanded ? '收起' : DEMAND_DESCRIPTION_MORE}
              <ChevronDown size={13} aria-hidden />
            </button>
          </section>
          <section className="dmd-group">
            <h3 className="dmd-detail-section">附件</h3>
            <p className="dmd-detail-empty">
              演示数据不能上传附件。新建需求保存后再回来上传图片、文档或视频。
            </p>
          </section>
        </section>
      );
    }
    return (
      <>
        <div className="dmd-people">
          {people.map((person, index) => {
            const item = meta[index];
            return (
              <Fragment key={person.role}>
                <div className="dmd-person" data-testid="demand-person">
                  <span className="dmd-person-role">{person.role}</span>
                  <span className="dmd-person-body">
                    <Avatar name={person.name} size={24} />
                    <span className="dmd-person-text">
                      <span className="dmd-person-name">{person.name}</span>
                      <span className="dmd-person-title">{person.title}</span>
                    </span>
                  </span>
                </div>
                {item !== undefined && (
                  <div className="dmd-person" data-testid="demand-field">
                    <span className="dmd-person-role">{item.label}</span>
                    <span className="dmd-person-body dmd-person-plain">
                      {item.tag ? <span className="dmd-value-tag">{item.value}</span> : item.value}
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
        <section className="dmd-group dmd-desc">
          <h3 className="dmd-detail-section">需求描述</h3>
          <p className="dmd-desc-text" data-expanded={descExpanded}>
            {description}
          </p>
          <button className="dmd-desc-more" type="button" onClick={onToggleDesc}>
            {descExpanded ? '收起' : DEMAND_DESCRIPTION_MORE}
            <ChevronDown size={13} aria-hidden />
          </button>
        </section>
      </>
    );
  }

  if (tab === '评审信息') {
    if (compact) {
      return (
        <section className="dmd-group">
          <h3 className="dmd-detail-section">评审信息</h3>
          <dl className="dmd-fields">
            <div className="dmd-field" data-testid="demand-field">
              <dt>
                <Diamond size={12} color={colorV2.textPlaceholder} aria-hidden />
                评审状态
              </dt>
              <dd>
                <span className="dmd-value-tag">{selected.reviewState}</span>
              </dd>
            </div>
          </dl>
        </section>
      );
    }
    return (
      <DemandReviewsTab
        demo
        demand={{
          id: selected.liveId ?? 0,
          demandNo: selected.id,
          demandName: selected.name,
          domainCode: selected.domain,
          proposerNo: selected.proposer,
          proposerName: selected.proposer,
          proposerDept: null,
          ownerNo: selected.owner,
          ownerName: selected.owner,
          proposedDate: selected.proposedDate,
          expectFinishDate: selected.expectedDate,
          description: selected.description ?? '',
          demandSource: selected.demandSource || null,
          demandType: selected.demandType || null,
          priority: selected.priority || null,
          reviewState: selected.reviewState,
          reviewDate: null,
          reviewConclusion: null,
          reviewOpinion: null,
          reviewRemark: null,
          outlet: null,
          solutionState: null,
          solutionName: null,
          devState: null,
          currentProcessState: selected.currentState ?? null,
          firstOnlineDate: null,
          latestOnlineDate: null,
          optimizeCount: null,
          deliveryMark: selected.deliveryMark ?? null,
          deliveredAt: null,
          archivedAt: null,
          acceptanceState: null,
          acceptorName: null,
          acceptedAt: null,
          acceptanceOpinion: null,
          acceptanceRound: null,
          courseCount: null,
          hasCourse: null,
          lastStateChangedAt: null,
          updatedAt: '',
          updatedBy: null,
          version: 0,
          light: 'NONE',
          lightDays: null,
          lightReason: null,
        }}
      />
    );
  }

  if (tab === '分流与处理') {
    if (!compact) {
      return (
        <DemandOutletTab
          demo
          demand={{
            id: selected.liveId ?? 0,
            demandNo: selected.id,
            demandName: selected.name,
            domainCode: selected.domain,
            proposerNo: selected.proposer,
            proposerName: selected.proposer,
            proposerDept: null,
            ownerNo: selected.owner,
            ownerName: selected.owner,
            proposedDate: selected.proposedDate,
            expectFinishDate: selected.expectedDate,
            description: selected.description ?? '',
            demandSource: selected.demandSource || null,
            demandType: selected.demandType || null,
            priority: selected.priority || null,
            reviewState: selected.reviewState,
            reviewDate: null,
            reviewConclusion: null,
            reviewOpinion: null,
            reviewRemark: null,
            outlet: null,
            solutionState: null,
            solutionName: null,
            devState: null,
            currentProcessState: selected.currentState ?? null,
            firstOnlineDate: null,
            latestOnlineDate: null,
            optimizeCount: null,
            deliveryMark: selected.deliveryMark ?? null,
            deliveredAt: null,
            archivedAt: null,
            acceptanceState: null,
            acceptorName: null,
            acceptedAt: null,
            acceptanceOpinion: null,
            acceptanceRound: null,
            courseCount: null,
            hasCourse: null,
            lastStateChangedAt: null,
            updatedAt: '',
            updatedBy: null,
            version: 0,
            light: 'NONE',
            lightDays: null,
            lightReason: null,
          }}
        />
      );
    }
    return (
      <>
        <section className="dmd-group">
          <h3 className="dmd-detail-section">{DEMAND_DETAIL_SECTION_TITLE}</h3>
          <dl className="dmd-fields">
            {detailFields.map((field) => (
              <div className="dmd-field" key={field.label} data-testid="demand-field">
                <dt>
                  <Diamond size={12} color={colorV2.textPlaceholder} aria-hidden />
                  {field.label}
                  {field.hint !== undefined && (
                    <span className="dmd-field-hint" title={field.hint}>
                      <Info size={12} color={colorV2.textTertiary} aria-hidden />
                    </span>
                  )}
                </dt>
                <dd>
                  {field.value === null ? (
                    <Blank />
                  ) : field.tag === true ? (
                    <span className="dmd-value-tag">{field.value}</span>
                  ) : (
                    field.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {selected.id === DEMAND_SELECTED_ID && (
          <>
            <div className="dmd-people">
              {DEMAND_DETAIL_PEOPLE.map((person, index) => {
                const item = DEMAND_DETAIL_META[index];
                return (
                  <Fragment key={person.role}>
                    <div className="dmd-person" data-testid="demand-person">
                      <span className="dmd-person-role">{person.role}</span>
                      <span className="dmd-person-body">
                        <Avatar name={person.name} size={24} />
                        <span className="dmd-person-text">
                          <span className="dmd-person-name">{person.name}</span>
                          <span className="dmd-person-title">{person.title}</span>
                        </span>
                      </span>
                    </div>
                    {item !== undefined && (
                      <div className="dmd-person" data-testid="demand-field">
                        <span className="dmd-person-role">{item.label}</span>
                        <span className="dmd-person-body dmd-person-plain">
                          {item.tag ? <span className="dmd-value-tag">{item.value}</span> : item.value}
                        </span>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
            <section className="dmd-group dmd-desc">
              <h3 className="dmd-detail-section">需求描述</h3>
              <p className="dmd-desc-text">{DEMAND_DESCRIPTION}</p>
              <button className="dmd-desc-more" type="button" onClick={onToggleDesc}>
                {descExpanded ? '收起' : DEMAND_DESCRIPTION_MORE}
                <ChevronDown size={13} aria-hidden />
              </button>
            </section>
          </>
        )}
      </>
    );
  }

  if (tab === '业务验收') {
    return (
      <p className="dmd-detail-empty">
        演示数据下不能走交付／验收／归档。新建真实需求后，可在此标记交付、录入验收结论，通过后归档退出预警。
      </p>
    );
  }

  if (tab === '关联课程') {
    return (
      <p className="dmd-detail-empty">
        暂无关联课程。接入业务数据后可在此关联课程；也可点底部「关联课程」进入本页签操作。
      </p>
    );
  }

  if (tab === '催办记录') {
    return (
      <p className="dmd-detail-empty">
        暂无催办记录。一期不发消息，「一键催办」只写入催办台账；完整台账见消息中心。
      </p>
    );
  }

  return (
    <p className="dmd-detail-empty">
      演示数据下不展示状态流转日志。新建需求或打开业务详情后，本页签按状态机自动留痕。
    </p>
  );
}
