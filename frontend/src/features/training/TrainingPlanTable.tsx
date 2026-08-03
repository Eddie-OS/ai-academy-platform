import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DatePicker, Input, Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { space } from '@/shared/theme/designTokens';
import { courseApi } from '@/shared/api/courses';
import { trainingApi, type TrainingPlan, type TrainingPlanFilter } from '@/shared/api/trainings';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { TrainingPlanFormModal } from '@/features/training/TrainingPlanFormModal';
import {
  TRAINING_OBJECT_TYPE_CODES,
  TRAINING_STATE_FIELDS,
  selectOptions,
  useEmployees,
  useStates,
} from '@/features/training/trainingMeta';
import { useIsOperator } from '@/shared/store/authStore';

interface TrainingPlanTableProps {
  onSelectPlan: (planId: number) => void;
  activePlanId: number | null;
}

/**
 * P4-2 培训计划列表（需求 11.9），在培训运营地图里作为底部分析区的一块。
 *
 * <p>默认展示列与筛选条件逐条对齐需求 11.9 的表。两处刻意的取舍：
 * <ul>
 *   <li><b>灯色列留位但不填值。</b>三色灯属阶段 3，此刻由页面自己算一遍，等阈值配置上线
 *       就会有两套判定，而其中一套不受配置影响（需求 13.9.2 要求阈值保存后实时重算）；
 *   <li><b>计划/实际场次数合成一列。</b>两个数分开看要自己做减法，而运营真正关心的
 *       是「还差几场没排」。
 * </ul>
 *
 * <p>计划的筛选与主区日历的场次筛选是两套：日历筛的是「哪天有课」，这里筛的是「哪个计划还没排完」。
 * 合成一套会让两边都筛不准。
 */
export function TrainingPlanTable({ onSelectPlan, activePlanId }: TrainingPlanTableProps) {
  const navigate = useNavigate();
  const isOperator = useIsOperator();
  const [filter, setFilter] = useState<TrainingPlanFilter>({});
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [courseKeyword, setCourseKeyword] = useState('');

  const employees = useEmployees();
  const planStates = useStates(TRAINING_OBJECT_TYPE_CODES.plan, TRAINING_STATE_FIELDS.plan);

  const page = useQuery({
    queryKey: ['training-plans', filter, pageNum, pageSize],
    queryFn: () => trainingApi.plans(filter, pageNum, pageSize),
  });

  const courses = useQuery({
    queryKey: ['courses', 'plan-filter', courseKeyword],
    queryFn: () => courseApi.page({ keyword: courseKeyword || null }, 1, 20),
  });

  const patch = (next: Partial<TrainingPlanFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = Object.values(filter).some(
    (value) => value !== null && value !== undefined && value !== '',
  );

  const columns: DataTableColumn<TrainingPlan>[] = [
    { key: 'planNo', title: '计划ID', kind: 'code', dataIndex: 'planNo', sortable: true },
    {
      key: 'planName',
      title: '计划名称',
      kind: 'name',
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => onSelectPlan(row.id)}>
          {row.planName}
        </Button>
      ),
    },
    { key: 'courseName', title: '关联课程', kind: 'name', dataIndex: 'courseName' },
    {
      key: 'ownerName',
      title: '培训负责人',
      kind: 'person',
      render: (row) => row.ownerName ?? row.ownerNo,
    },
    {
      key: 'planRange',
      title: '计划起止日期',
      kind: 'datetime',
      render: (row) => `${row.planStartDate} ~ ${row.planEndDate}`,
      sortable: true,
    },
    {
      key: 'sessionCount',
      title: '计划/实际场次数',
      kind: 'number',
      width: 130,
      // 计划场次数留空是常态（还没定），此时只给实际数，不要显示成「0/3」那样的假分母
      render: (row) =>
        row.planSessionCount === null
          ? `${row.actualSessionCount}`
          : `${row.planSessionCount} / ${row.actualSessionCount}`,
    },
    { key: 'planState', title: '计划状态', kind: 'statusMain', dataIndex: 'planState' },
    {
      key: 'warningLight',
      title: '灯色',
      kind: 'light',
      // 留位不填值：阶段 3 的 aggregate/warning 落地后换成后端给的灯色与天数。
      // 此刻渲染成「健康」是在替后端下结论——一个逾期两个月的计划会被标成健康
      render: () => null,
    },
    {
      key: 'actions',
      title: '操作',
      kind: 'actions',
      width: actionsWidth(1),
      render: (row) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onSelectPlan(row.id)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <AnalyticsCard
      title="培训计划列表"
      note="计划与场次是两级对象：计划定「面向谁、什么时间段、排几场」，场次定「哪天、谁讲、在哪」。点计划名在右侧看详情与下属场次。"
      extra={
        <Space wrap size={space.xs}>
          <Input.Search
            allowClear
            size="small"
            placeholder="计划ID / 名称"
            style={{ width: 180 }}
            onSearch={(value) => patch({ keyword: value })}
          />
          <Select
            allowClear
            showSearch
            size="small"
            filterOption={false}
            placeholder="关联课程"
            style={{ width: 180 }}
            onSearch={setCourseKeyword}
            notFoundContent={courses.isLoading ? '加载中' : '没有匹配的课程'}
            options={(courses.data?.records ?? []).map((item) => ({
              value: item.id,
              label: `${item.courseName}（${item.courseNo}）`,
            }))}
            onChange={(value) => patch({ courseId: value ?? null })}
          />
          <Select
            allowClear
            showSearch
            size="small"
            optionFilterProp="label"
            placeholder="培训负责人"
            style={{ width: 150 }}
            options={(employees.data?.records ?? []).map((item) => ({
              value: item.employeeNo,
              label: `${item.employeeName}（${item.employeeNo}）`,
            }))}
            onChange={(value) => patch({ ownerNo: value ?? null })}
          />
          <Select
            allowClear
            size="small"
            placeholder="计划状态"
            style={{ width: 120 }}
            options={selectOptions(planStates)}
            onChange={(value) => patch({ planState: value ?? null })}
          />
          <DatePicker.RangePicker
            size="small"
            placeholder={['计划期间起', '计划期间止']}
            onChange={(range) =>
              patch({
                dateFrom: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null,
                dateTo: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null,
              })
            }
          />
        </Space>
      }
    >
      <DataTable<TrainingPlan>
        storageKey="training-plans"
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
        error={page.isError ? '培训计划列表没有取到。' : null}
        onReload={() => void page.refetch()}
        filtered={filtered}
        objectName="培训计划"
        emptyDescription="培训计划建好后在右侧详情面板往下排场次，场次号是「计划号-序号」。"
        onRowClick={(row) => onSelectPlan(row.id)}
        activeRowKey={activePlanId === null ? null : String(activePlanId)}
        onResetFilters={() => {
          setFilter({});
          setPageNum(1);
        }}
        toolbarExtra={
          isOperator && (
            <Button type="primary" size="small" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
              新建培训计划
            </Button>
          )
        }
      />

      <TrainingPlanFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          navigate(`/training-plans/${id}`);
        }}
      />
    </AnalyticsCard>
  );
}
