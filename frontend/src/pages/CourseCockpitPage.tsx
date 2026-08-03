import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Input,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Pencil, Plus, Table2 } from 'lucide-react';
import dayjs from 'dayjs';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import { courseApi, type Course, type CourseFilter } from '@/shared/api/courses';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { STATUS_TAG_GROUPS, StatusTag } from '@/shared/ui/StatusTag';
import {
  AnalyticsCard,
  AnalyticsRow,
  CockpitDetailPanel,
  CockpitLayout,
} from '@/shared/ui/CockpitLayout';
import { COURSE_METRICS } from '@/shared/metrics/cockpitMetrics';
import { PageState } from '@/shared/ui/PageState';
import { CourseFormModal } from '@/features/course/CourseFormModal';
import { CourseTransitionPanel } from '@/features/course/CourseTransitionPanel';
import { CourseStateMap } from '@/features/course/CourseStateMap';
import { CourseScheduleBoard } from '@/features/course/CourseScheduleBoard';
import { CourseMaterialsTab, formatDateTime } from '@/features/course/CourseMaterialsTab';
import { CourseDemandsTab } from '@/features/course/CourseDemandsTab';
import { CourseSelfcheckTab } from '@/features/course/CourseSelfcheckTab';
import { CourseReviewsTab } from '@/features/course/CourseReviewsTab';
import { CourseTrialsTab } from '@/features/course/CourseTrialsTab';
import { CourseStateLogTab } from '@/features/course/CourseStateLogTab';
import {
  COURSE_OBJECT_TYPE_CODE,
  COURSE_STATE_FIELDS,
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
  useMachines,
} from '@/features/course/courseMeta';
import { useIsOperator } from '@/shared/store/authStore';

const { Text } = Typography;

/**
 * 驾驶舱二 · 课程工作台（设计稿《课程工作台》）。
 *
 * <p>一屏装下需求文档 9.2／9.9／9.10 的四页：<b>P2-3 课程状态地图</b>与 <b>P2-1 课程列表</b>
 * 是主区的两个视图，<b>P2-2 课程详情</b>的七个页签是右列面板，<b>P2-4 课程排期日历</b>在底部
 * 分析区。
 *
 * <p><b>为什么主区是「地图 / 列表」两个视图而不是只留一个。</b>设计稿画的是状态地图，它回答
 * 「这批课都卡在哪一环」；但需求 9.10 的十个筛选条件与十二列表格回答的是「符合这些条件的
 * 是哪几门」，看板形态下这些列没有落点。两个视图共用同一份筛选条件，切换时筛出的是同一批课。
 * 这与设计稿《案例与组织覆盖》的「卡片视图 / 列表视图」切换是同一套做法。
 */

type MainView = 'map' | 'list';

export function CourseCockpitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();

  const [view, setView] = useState<MainView>('map');
  const [filter, setFilter] = useState<CourseFilter>({});
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedId = Number(id);
  const hasSelection = Number.isFinite(selectedId) && selectedId > 0;

  useEffect(() => setExpanded(false), [id]);

  const fieldEnums = useFieldEnums();
  const dicts = useDicts();
  const machines = useMachines();
  const employees = useEmployees();

  const page = useQuery({
    queryKey: ['courses', filter, pageNum, pageSize],
    queryFn: () => courseApi.page(filter, pageNum, pageSize),
    enabled: view === 'list',
  });

  const detail = useQuery({
    queryKey: ['courses', selectedId, 'detail'],
    queryFn: () => courseApi.detail(selectedId),
    enabled: hasSelection,
  });

  const courseMachines = useMemo(
    () => (machines.data ?? []).filter((m) => m.objectType === COURSE_OBJECT_TYPE_CODE),
    [machines.data],
  );
  const mainStates = courseMachines.find((m) => m.stateField === COURSE_STATE_FIELDS.main)?.states ?? [];
  // 四组子状态的取值两两不相交，合并成一个下拉（与后端 CourseQuery.subState 同一个入参）
  const subStates = courseMachines
    .filter((m) => m.stateField !== COURSE_STATE_FIELDS.main)
    .flatMap((m) => m.states)
    .filter((state) => state !== '（空）');

  const patch = (next: Partial<CourseFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = Object.values(filter).some(
    (value) => value !== null && value !== undefined && value !== '',
  );

  const select = (courseId: number) => navigate(`/courses/${courseId}`);

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
    { key: 'reviewTrack', title: '评审轨道', kind: 'statusSub', dataIndex: 'reviewTrack' },
    { key: 'domainCode', title: '所属领域', kind: 'combatUnit', dataIndex: 'domainCode' },
    { key: 'ownerName', title: '课程负责人', kind: 'person', dataIndex: 'ownerName' },
    { key: 'mainState', title: '主状态', kind: 'statusMain', dataIndex: 'mainState' },
    {
      key: 'subState',
      title: '子状态',
      kind: 'statusSub',
      // 四个子状态列在一列里：同一时刻只有一个是有值的，分成四列会有三列永远是「—」
      render: (row) => row.devState ?? row.selfcheckState ?? row.trialState ?? row.publishState,
    },
    { key: 'reviewRound', title: '当前评审轮次', kind: 'number', dataIndex: 'reviewRound' },
    {
      key: 'expectPublishDate',
      title: '预计发布时间',
      kind: 'date',
      dataIndex: 'expectPublishDate',
      sortable: true,
    },
    {
      key: 'validityStatus',
      title: '有效期状态',
      kind: 'validity',
      // 正常态不挂标签（SV1），此时用中性文字兜住——整格空白会被当成「没数据」。
      // 判断依据是标签表里有没有这个取值，不是把「有效」「未发布」抄进前端
      render: (row) =>
        STATUS_TAG_GROUPS.courseValidity[row.validityStatus] ? (
          <StatusTag group="courseValidity" value={row.validityStatus} />
        ) : (
          <Text type="secondary">{row.validityStatus}</Text>
        ),
    },
    {
      key: 'warningLight',
      title: '灯色',
      kind: 'light',
      // 留位不填值：阶段 3 的 aggregate/warning 落地后换成后端给的灯色与天数。
      // 此刻渲染成「健康」是在替后端下结论——一门逾期两个月的课程会被标成健康
      render: () => null,
    },
    {
      key: 'qualityMarks',
      title: '精品标注',
      kind: 'tags',
      render: (row) =>
        row.qualityMarks.length > 0 ? (
          <Space size={4}>
            {row.qualityMarks.map((mark) => (
              <Tag key={mark}>{mark}</Tag>
            ))}
          </Space>
        ) : null,
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
        subtitle="点看板卡片或列表任一行在右侧展开该课程的七个页签。状态一律由运营手动流转，平台只记录线下已经发生的事。"
        actions={
          <Space size={space.xs}>
            <Segmented<MainView>
              value={view}
              onChange={setView}
              options={[
                { value: 'map', label: '状态地图', icon: <LayoutGrid size={14} /> },
                { value: 'list', label: '课程列表', icon: <Table2 size={14} /> },
              ]}
            />
            {isOperator && (
              <Button type="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                课程立项
              </Button>
            )}
          </Space>
        }
        metrics={COURSE_METRICS}
        filters={
          <Space wrap size={space.xs}>
            <Input.Search
              allowClear
              placeholder="课程ID / 名称 / 简介"
              style={{ width: 240 }}
              onSearch={(value) => patch({ keyword: value })}
            />
            <Select
              allowClear
              placeholder="评审轨道"
              style={{ width: 150 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewTrack])}
              onChange={(value) => patch({ reviewTrack: value ?? null })}
            />
            <Select
              allowClear
              showSearch
              placeholder="所属领域"
              style={{ width: 150 }}
              options={(dicts.data?.[DICT_KEYS.combatUnit] ?? []).map((item) => ({
                value: item.code,
                label: item.name,
              }))}
              onChange={(value) => patch({ domainCode: value ?? null })}
            />
            <Select
              allowClear
              placeholder="主状态"
              style={{ width: 130 }}
              options={selectOptions(mainStates)}
              onChange={(value) => patch({ mainState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="子状态"
              style={{ width: 130 }}
              options={selectOptions(subStates)}
              onChange={(value) => patch({ subState: value ?? null })}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="课程负责人"
              style={{ width: 160 }}
              options={(employees.data?.records ?? []).map((item) => ({
                value: item.employeeNo,
                label: `${item.employeeName}（${item.employeeNo}）`,
              }))}
              onChange={(value) => patch({ ownerNo: value ?? null })}
            />
            <Select
              allowClear
              placeholder="有效期状态"
              style={{ width: 140 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.validityStatus])}
              onChange={(value) => patch({ validityStatus: value ?? null })}
            />
            <Select
              allowClear
              placeholder="精品标注"
              style={{ width: 120 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.qualityMark])}
              onChange={(value) => patch({ qualityMark: value ?? null })}
            />
            <DatePicker.RangePicker
              placeholder={['预计发布起', '预计发布止']}
              onChange={(range) =>
                patch({
                  expectPublishFrom: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null,
                  expectPublishTo: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null,
                })
              }
            />
            <Select
              allowClear
              placeholder="关联需求"
              style={{ width: 130 }}
              options={[
                { value: 'true', label: '有关联需求' },
                { value: 'false', label: '无关联需求' },
              ]}
              onChange={(value) => patch({ hasDemand: value === undefined ? null : value === 'true' })}
            />
          </Space>
        }
        main={
          view === 'map' ? (
            <CourseStateMap
              filter={filter}
              onSelect={select}
              activeId={hasSelection ? selectedId : null}
            />
          ) : (
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
              emptyDescription="课程从「立项」开始，立项后再按线下进度手动推进状态。"
              onResetFilters={() => {
                setFilter({});
                setPageNum(1);
              }}
              onRowClick={(row) => select(row.id)}
              activeRowKey={hasSelection ? String(selectedId) : null}
            />
          )
        }
        detailExpanded={expanded}
        detail={
          hasSelection && (
            <CockpitDetailPanel
              expanded={expanded}
              onToggleExpand={() => setExpanded((value) => !value)}
              onClose={() => navigate('/courses')}
              title={data?.courseName ?? '加载中'}
              titleExtra={
                data && (
                  <>
                    <Tag>{data.courseNo}</Tag>
                    <Tag color="blue">{data.mainState}</Tag>
                    <StatusTag group="courseValidity" value={data.validityStatus} />
                  </>
                )
              }
              meta={
                data && (
                  <>
                    最后修改 {formatDateTime(data.updatedAt)}
                    {data.updatedBy ? ` · ${data.updatedBy}` : ''}
                    {/* 状态变更时间与最后修改时间是两件事：改错别字不该让「停滞多久」归零 */}
                    {data.lastStateChangedAt
                      ? ` · 状态最后变更于 ${formatDateTime(data.lastStateChangedAt)}`
                      : ''}
                  </>
                )
              }
              actions={
                isOperator &&
                data && (
                  <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                    编辑
                  </Button>
                )
              }
              stateArea={data && <CourseTransitionPanel course={data} />}
            >
              {detail.isError ? (
                <PageState
                  variant="error"
                  description="这门课程没有取到，可能已被删除。"
                  action={<Button onClick={() => navigate('/courses')}>回到课程工作台</Button>}
                />
              ) : (
                <Tabs
                  size="small"
                  items={[
                    { key: 'basic', label: '基本信息', children: data ? <BasicInfo course={data} /> : null },
                    { key: 'demands', label: '关联需求', children: hasSelection ? <CourseDemandsTab courseId={selectedId} /> : null },
                    { key: 'materials', label: '材料与版本', children: hasSelection ? <CourseMaterialsTab courseId={selectedId} /> : null },
                    { key: 'selfcheck', label: 'CheckList 自检', children: hasSelection ? <CourseSelfcheckTab courseId={selectedId} /> : null },
                    { key: 'reviews', label: '评审记录', children: hasSelection ? <CourseReviewsTab courseId={selectedId} /> : null },
                    { key: 'trials', label: '试讲记录', children: hasSelection ? <CourseTrialsTab courseId={selectedId} /> : null },
                    { key: 'logs', label: '状态流转日志', children: hasSelection ? <CourseStateLogTab courseId={selectedId} /> : null },
                  ]}
                />
              )}
            </CockpitDetailPanel>
          )
        }
        analytics={
          // 日历吃宽度：一格里要放下两条「节点名·课程名」，平分会让每条都省略成三个字
          <AnalyticsRow columns="minmax(0, 3fr) minmax(0, 2fr)">
            <CourseScheduleBoard onSelect={select} />
            <AnalyticsCard
              title="数据概览"
              note="设计稿这块放的是状态分布、新增课程数、评审通过率，三项都属阶段 3 的 54 个指标"
            >
              <PageState
                variant="empty"
                objectName="课程指标"
                description="课程状态分布、本月新增课程数、一次评审通过率由阶段 3 的 aggregate/metrics 统一计算。此刻在这里现算一遍，等阈值与口径配置上线后会有两套数字，而其中一套不受配置影响。"
              />
            </AnalyticsCard>
          </AnalyticsRow>
        }
      />

      <CourseFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(newId) => {
          setCreating(false);
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
            void queryClient.invalidateQueries({ queryKey: ['courses'] });
          }}
        />
      )}
    </>
  );
}

/** 面板宽 460px，描述列表用一列：两列会让「预计发布时间」这类标签换行，标签一换行就读不出对应关系。 */
function BasicInfo({ course }: { course: Course }) {
  return (
    <Card size="small" styles={{ body: { padding: space.sm } }}>
      <Descriptions
        column={1}
        size="small"
        styles={{ label: { color: neutral[600], width: 116, fontSize: fontSize.bodySm } }}
        items={[
          { key: 'no', label: '课程ID', children: course.courseNo },
          { key: 'track', label: '评审轨道', children: course.reviewTrack },
          { key: 'domain', label: '所属领域', children: course.domainCode },
          { key: 'category', label: '课程分类', children: course.categoryCode ?? '—' },
          { key: 'owner', label: '课程负责人', children: course.ownerName ?? course.ownerNo },
          { key: 'hours', label: '课时', children: course.classHours ? `${course.classHours} 学时` : '—' },
          { key: 'initiated', label: '立项时间', children: course.initiatedDate },
          { key: 'expect', label: '预计发布时间', children: course.expectPublishDate },
          { key: 'firstPublish', label: '首次发布时间', children: course.firstPublishDate ?? '—' },
          { key: 'validity', label: '课程有效期', children: course.validityPeriod },
          {
            key: 'validityEnd',
            label: '有效期截止',
            children: course.validityEndDate
              ? `${course.validityEndDate}${course.daysToExpiry === null ? '' : `（${expiryText(course.daysToExpiry)}）`}`
              : '—',
          },
          { key: 'version', label: '当前材料版本', children: course.currentMaterialVersion ?? '—' },
          {
            key: 'round',
            label: '当前评审轮次',
            children: course.reviewRound ? `第 ${course.reviewRound} 轮` : '—',
          },
          {
            key: 'marks',
            label: '精品标注',
            children: course.qualityMarks.length > 0 ? course.qualityMarks.join('、') : '—',
          },
          { key: 'audience', label: '面向人群', children: course.targetAudience ?? '—' },
          {
            key: 'link',
            label: '课程外部链接',
            children: course.externalLink ? (
              <a href={course.externalLink} target="_blank" rel="noreferrer">
                {course.externalLink}
              </a>
            ) : (
              '—'
            ),
          },
          {
            key: 'summary',
            label: '课程简介',
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{course.summary ?? '—'}</Text>,
          },
        ]}
      />
    </Card>
  );
}

/** 距到期天数：已过期时后端给的是负数，直接展示会变成「剩余 -12 天」。 */
function expiryText(days: number): string {
  return days < 0 ? `已过期 ${Math.abs(days)} 天` : `剩余 ${days} 天`;
}
