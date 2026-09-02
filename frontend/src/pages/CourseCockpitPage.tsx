import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { fontSize, space } from '@/shared/theme/designTokens';
import { courseApi, type Course } from '@/shared/api/courses';
import {
  EMPTY_COURSE_FILTER,
  filterForCourseKpi,
  invalidateCourseListAndMetrics,
  isCourseFilterActive,
  selectedCourseKpiId,
  toCourseApiFilter,
  type CourseWorkbenchFilter,
} from '@/features/course/courseFilters';
import type { CourseKpiId } from '@/fixtures/course';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { AnalyticsRow, CockpitLayout } from '@/shared/ui/CockpitLayout';
import { COURSE_METRICS, mergeMetricValues } from '@/shared/metrics/cockpitMetrics';
import { metricsApi } from '@/shared/api/metrics';
import { WarningLightCell } from '@/shared/ui/WarningLight';
import { PageState } from '@/shared/ui/PageState';
import { CourseFormModal } from '@/features/course/CourseFormModal';
import { CourseScheduleBoard } from '@/features/course/CourseScheduleBoard';
import { CourseMaterialsTab, formatDateTime } from '@/features/course/CourseMaterialsTab';
import { CourseSelfcheckTab } from '@/features/course/CourseSelfcheckTab';
import { CourseReviewsTab } from '@/features/course/CourseReviewsTab';
import { CourseTrialsTab } from '@/features/course/CourseTrialsTab';
import { CourseStateLogTab } from '@/features/course/CourseStateLogTab';
import { CourseInitiateTab } from '@/features/course/CourseInitiateTab';
import { CourseDevelopTab } from '@/features/course/CourseDevelopTab';
import { CourseBasicInfo } from '@/features/course/CourseBasicInfo';
import {
  COURSE_OBJECT_TYPE_CODE,
  COURSE_REVIEW_OBJECT_TYPE_CODE,
  COURSE_REVIEW_STATE_FIELD,
  COURSE_STATE_FIELDS,
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useBusinessDomains,
  useDicts,
  useDomainLabel,
  useFieldEnums,
  useMachines,
} from '@/features/course/courseMeta';
import { useIsOperator } from '@/shared/store/authStore';

const { Text } = Typography;

/**
 * 驾驶舱二 · 课程工作台。
 *
 * <p>主区只保留列表（对齐需求列表），点行用弹窗看详情，进入工作台不预开详情。
 * 顶栏不放新建；运营从筛选行右侧进入「新建课程」。
 */

export function CourseCockpitPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const openTrialTab = params.get('tab') === 'trials' || params.get('tab') === '试讲';
  const [detailTab, setDetailTab] = useState(openTrialTab ? 'trials' : 'basic');

  const [filter, setFilter] = useState<CourseWorkbenchFilter>(EMPTY_COURSE_FILTER);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  const selectedId = Number(id);
  const hasSelection = Number.isFinite(selectedId) && selectedId > 0;

  const fieldEnums = useFieldEnums();
  const dicts = useDicts();
  const machines = useMachines();
  const businessDomains = useBusinessDomains();
  const domainLabelOf = useDomainLabel();

  const page = useQuery({
    queryKey: ['courses', filter, pageNum, pageSize],
    queryFn: () => courseApi.page(toCourseApiFilter(filter), pageNum, pageSize),
  });

  const quantity = useQuery({
    queryKey: ['metrics', 'quantity', 'courses'],
    queryFn: () => metricsApi.quantity('courses'),
  });

  const detail = useQuery({
    queryKey: ['courses', selectedId, 'detail'],
    queryFn: () => courseApi.detail(selectedId),
    enabled: hasSelection,
  });

  const courseMachines = machines.data?.filter((m) => m.objectType === COURSE_OBJECT_TYPE_CODE) ?? [];
  const statesOf = (field: string) =>
    courseMachines.find((m) => m.stateField === field)?.states.filter((state) => state !== '（空）') ?? [];

  const categoryName = (code: string | null) => {
    if (!code) return '—';
    return dicts.data?.[DICT_KEYS.courseCategory]?.find((item) => item.code === code)?.name ?? code;
  };
  const domainName = (code: string | null) => domainLabelOf(code) ?? '—';

  const reviewStates =
    machines.data
      ?.find(
        (machine) =>
          machine.objectType === COURSE_REVIEW_OBJECT_TYPE_CODE &&
          machine.stateField === COURSE_REVIEW_STATE_FIELD,
      )
      ?.states.filter((state) => state !== '（空）') ?? [];

  const patch = (next: Partial<CourseWorkbenchFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = isCourseFilterActive(filter);

  const select = (courseId: number) => navigate(`/courses/${courseId}`);

  useEffect(() => {
    setDetailTab(openTrialTab ? 'trials' : 'basic');
  }, [selectedId, openTrialTab]);
  /* 主路径默认是 V2 复刻件，回列表必须带 ?legacy=1，否则关掉详情就掉出业务页 */
  const closeDetail = () => navigate('/courses?legacy=1');

  const columns: DataTableColumn<Course>[] = [
    { key: 'courseNo', title: '课程ID', kind: 'code', dataIndex: 'courseNo', sortable: true },
    {
      key: 'courseName',
      title: '课程名称',
      kind: 'name',
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => select(row.id)}>
          {row.courseName}
        </Button>
      ),
    },
    {
      key: 'domainCode',
      title: '领域',
      kind: 'combatUnit',
      render: (row) => domainName(row.domainCode),
    },
    {
      key: 'categoryCode',
      title: '课程类型',
      kind: 'tags',
      render: (row) => categoryName(row.categoryCode),
    },
    { key: 'ownerName', title: '负责人', kind: 'person', dataIndex: 'ownerName' },
    { key: 'mainState', title: '立项状态', kind: 'statusMain', dataIndex: 'mainState' },
    { key: 'devState', title: '开发状态', kind: 'statusSub', dataIndex: 'devState' },
    { key: 'selfcheckState', title: '自检状态', kind: 'statusSub', dataIndex: 'selfcheckState' },
    {
      key: 'reviewState',
      title: '评审状态',
      kind: 'statusSub',
      render: (row) => row.reviewRecordState ?? (row.reviewRound ? `第 ${row.reviewRound} 轮` : '—'),
    },
    { key: 'trialState', title: '试讲状态', kind: 'statusSub', dataIndex: 'trialState' },
    {
      key: 'warningLight',
      title: '灯色',
      kind: 'light',
      render: (row) => <WarningLightCell light={row.light} lightDays={row.lightDays} />,
    },
    {
      key: 'lightDays',
      title: '剩余/逾期天数',
      kind: 'number',
      render: (row) => daysLabel(row.lightDays, row.lightReason),
    },
    {
      key: 'actions',
      title: '操作',
      kind: 'actions',
      width: actionsWidth(1),
      render: (row) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => select(row.id)}>
          查看
        </Button>
      ),
    },
  ];

  const data = detail.data;

  return (
    <>
      <CockpitLayout
        title="课程工作台"
        subtitle="记录课程从立项到发布已经发生的事。点列表打开详情弹窗。"
        metrics={mergeMetricValues(COURSE_METRICS, quantity.data).map((spec) => ({
          ...spec,
          selected: spec.key === selectedCourseKpiId(filter),
          onClick: () => {
            const kpiId = spec.key as CourseKpiId;
            setFilter((current) =>
              selectedCourseKpiId(current) === kpiId && kpiId !== 'total'
                ? EMPTY_COURSE_FILTER
                : filterForCourseKpi(kpiId),
            );
            setPageNum(1);
          },
        }))}
        filters={
          <Space wrap size={space.xs} style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap size={space.xs}>
              <Input.Search
                allowClear
                placeholder="课程ID / 名称"
                style={{ width: 240 }}
                value={filter.keyword}
                onChange={(event) => patch({ keyword: event.target.value })}
                onSearch={(value) => patch({ keyword: value })}
              />
              <Select
                allowClear
                showSearch
                placeholder="领域"
                style={{ width: 150 }}
                value={filter.domainCode || undefined}
                options={businessDomains.map((domain) => ({
                  value: domain,
                  label: domain,
                }))}
                onChange={(value) => patch({ domainCode: value ?? '' })}
              />
              <Select
                allowClear
                showSearch
                placeholder="课程类型"
                style={{ width: 150 }}
                value={filter.categoryCode || undefined}
                options={(dicts.data?.[DICT_KEYS.courseCategory] ?? []).map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
                onChange={(value) => patch({ categoryCode: value ?? '' })}
              />
              <Select
                allowClear
                placeholder="开发状态"
                style={{ width: 130 }}
                value={filter.devState || undefined}
                options={selectOptions(statesOf(COURSE_STATE_FIELDS.dev))}
                onChange={(value) => patch({ devState: value ?? '' })}
              />
              <Select
                allowClear
                placeholder="自检状态"
                style={{ width: 130 }}
                value={filter.selfcheckState || undefined}
                options={selectOptions(statesOf(COURSE_STATE_FIELDS.selfcheck))}
                onChange={(value) => patch({ selfcheckState: value ?? '' })}
              />
              <Select
                allowClear
                placeholder="评审状态"
                style={{ width: 130 }}
                value={filter.reviewRecordState || undefined}
                options={selectOptions(reviewStates)}
                onChange={(value) => patch({ reviewRecordState: value ?? '' })}
              />
              <Select
                allowClear
                placeholder="试讲状态"
                style={{ width: 130 }}
                value={filter.trialState || undefined}
                options={selectOptions(statesOf(COURSE_STATE_FIELDS.trial))}
                onChange={(value) => patch({ trialState: value ?? '' })}
              />
              <Select
                allowClear
                placeholder="灯色"
                style={{ width: 120 }}
                value={filter.light || undefined}
                options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.light])}
                onChange={(value) => patch({ light: value ?? '' })}
              />
            </Space>
            {isOperator && (
              <Button type="primary" onClick={() => setCreating(true)}>
                新建课程
              </Button>
            )}
          </Space>
        }
        main={
          <DataTable<Course>
            storageKey="courses"
            columns={columns}
            rows={page.data?.records}
            rowKey={(row) => String(row.id)}
            total={page.data?.total ?? 0}
            pageNum={pageNum}
            pageSize={pageSize}
            onPageChange={(nextPage, nextSize) => {
              setPageNum(nextPage);
              setPageSize(nextSize);
            }}
            loading={page.isLoading}
            error={page.isError ? '课程列表没有取到。' : null}
            onReload={() => void page.refetch()}
            filtered={filtered}
            objectName="课程"
            emptyDescription="还没有课程。运营可从筛选行右侧新建。"
            onResetFilters={() => {
              setFilter(EMPTY_COURSE_FILTER);
              setPageNum(1);
            }}
            onRowClick={(row) => select(row.id)}
            activeRowKey={hasSelection ? String(selectedId) : null}
          />
        }
        analytics={
          <AnalyticsRow columns="minmax(0, 1fr)">
            <CourseScheduleBoard onSelect={select} />
          </AnalyticsRow>
        }
      />

      <Modal
        open={hasSelection}
        title={null}
        footer={null}
        width={920}
        destroyOnHidden
        onCancel={closeDetail}
        styles={{ body: { paddingTop: space.sm } }}
      >
        {detail.isError ? (
          <PageState
            variant="error"
            description="这门课程没有取到，可能已被删除。"
            action={<Button onClick={closeDetail}>回到课程工作台</Button>}
          />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space size={space.xs} wrap>
                  <Text strong style={{ fontSize: fontSize.h3 }}>
                    {data?.courseName ?? '加载中'}
                  </Text>
                  {data && (
                    <>
                      <Tag>{data.courseNo}</Tag>
                      <Tag>{data.mainState}</Tag>
                    </>
                  )}
                </Space>
                {data && (
                  <div>
                    <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                      最后修改 {formatDateTime(data.updatedAt)}
                      {data.updatedBy ? ` · ${data.updatedBy}` : ''}
                      {data.lastStateChangedAt
                        ? ` · 状态最后变更于 ${formatDateTime(data.lastStateChangedAt)}`
                        : ''}
                    </Text>
                  </div>
                )}
              </div>
              {isOperator && data && (
                <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                  编辑
                </Button>
              )}
            </div>
            <Tabs
              size="small"
              activeKey={detailTab}
              onChange={setDetailTab}
              items={[
                { key: 'basic', label: '基本信息', children: data ? <CourseBasicInfo course={data} /> : null },
                { key: 'initiate', label: '立项', children: data ? <CourseInitiateTab course={data} /> : null },
                { key: 'develop', label: '开发', children: data ? <CourseDevelopTab course={data} /> : null },
                { key: 'selfcheck', label: '自检', children: data ? <CourseSelfcheckTab course={data} /> : null },
                { key: 'reviews', label: '评审', children: data ? <CourseReviewsTab course={data} /> : null },
                { key: 'trials', label: '试讲', children: data ? <CourseTrialsTab course={data} /> : null },
                { key: 'materials', label: '材料与版本', children: data ? <CourseMaterialsTab course={data} /> : null },
                { key: 'logs', label: '状态流转日志', children: hasSelection ? <CourseStateLogTab courseId={selectedId} /> : null },
              ]}
            />
          </>
        )}
      </Modal>

      <CourseFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(newId) => {
          setCreating(false);
          invalidateCourseListAndMetrics(queryClient);
          select(newId);
        }}
      />

      {data && (
        <CourseFormModal
          open={editing}
          course={data}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            invalidateCourseListAndMetrics(queryClient);
          }}
        />
      )}
    </>
  );
}

function daysLabel(days: number | null, reason: string | null): string {
  if (days === null) return '—';
  if (reason) return `${reason} · ${days} 天`;
  return `剩余 ${days} 天`;
}
