import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DatePicker, Descriptions, Input, Select, Space, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { lecturerApi, type TrialLedgerFilter, type TrialLedgerRow } from '@/shared/api/lecturers';
import { trialLedgerYesNoOf } from '@/fixtures/lecturer';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { space } from '@/shared/theme/designTokens';
import {
  FIELD_ENUM_KEYS,
  TRIAL_OBJECT_TYPE_CODE,
  TRIAL_STATE_FIELD,
  selectOptions,
  useFieldEnums,
  useStates,
} from './lecturerMeta';

/**
 * P3-3 试讲台账（需求 10.2），在讲师驾驶舱里作为底部分析区。
 *
 * <p><b>台账只读。</b>录结论仍走课程详情页的试讲页签——那条路径在一个事务里同时推进试讲记录
 * 状态、课程试讲子状态与讲师试讲合格标记。在台账上另开一个录入口就会有两条写路径，
 * 而两条路径迟早只有一条是完整的。这里给的是「去课程页录」的入口。
 *
 * <p>列名与取值跟课程工作台·课程试讲对齐：试讲轮数、讲师试讲是否合格、课程是否满足发布要求、
 * 试讲时间；结论只展示是／否。不再单独列「结论一致」。
 */

interface TrialLedgerTableProps {
  /** 当前在右侧面板打开的讲师，点讲师名时高亮用 */
  activeLecturerId: number | null;
  onSelectLecturer: (lecturerId: number) => void;
}

export function TrialLedgerTable({ activeLecturerId, onSelectLecturer }: TrialLedgerTableProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TrialLedgerFilter>({});
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fieldEnums = useFieldEnums();
  const recordStates = useStates(TRIAL_OBJECT_TYPE_CODE, TRIAL_STATE_FIELD);
  const conclusions = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.trialConclusion]);

  const page = useQuery({
    queryKey: ['trial-ledger', filter, pageNum, pageSize],
    queryFn: () => lecturerApi.trialLedger(filter, pageNum, pageSize),
  });

  const patch = (next: Partial<TrialLedgerFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = Object.values(filter).some(
    (value) => value !== null && value !== undefined && value !== '',
  );

  const columns: DataTableColumn<TrialLedgerRow>[] = [
    { key: 'trialDate', title: '试讲时间', kind: 'date', dataIndex: 'trialDate', sortable: true },
    {
      key: 'courseName',
      title: '课程',
      kind: 'name',
      sortable: true,
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/courses/${row.courseId}`)}>
          {row.courseName}
        </Button>
      ),
    },
    { key: 'roundNo', title: '试讲轮数', kind: 'number', sortable: true, render: (row) => `第 ${row.roundNo} 轮` },
    {
      key: 'lecturerName',
      title: '试讲讲师',
      kind: 'person',
      // person 的基准 96px 装不下四字表头加排序箭头，表头会折成两行（表头不允许截断，TB4）
      width: 116,
      sortable: true,
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => onSelectLecturer(row.lecturerId)}>
          {row.lecturerName}
        </Button>
      ),
    },
    {
      key: 'courseConclusion',
      title: '课程是否满足发布要求',
      kind: 'statusSub',
      width: 176,
      render: (row) => (row.courseConclusion ? <Tag color="blue">{trialLedgerYesNoOf(row.courseConclusion)}</Tag> : null),
    },
    {
      key: 'lecturerConclusion',
      title: '讲师试讲是否合格',
      kind: 'statusSub',
      width: 148,
      render: (row) =>
        row.lecturerConclusion ? <Tag color="blue">{trialLedgerYesNoOf(row.lecturerConclusion)}</Tag> : null,
    },
    { key: 'recordState', title: '记录状态', kind: 'statusSub', dataIndex: 'recordState' },
    {
      key: 'actions',
      title: '操作',
      kind: 'actions',
      width: actionsWidth(1),
      render: (row) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={() => navigate(`/courses/${row.courseId}?tab=trials`)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <AnalyticsCard
      title="试讲台账"
      note="全部课程的试讲记录汇总。台账只读，结论在课程详情页的试讲页签录入——那条路径同时推进试讲记录状态、课程试讲子状态与讲师试讲合格标记，三件事必须在一个事务里。"
      extra={
        <Space wrap size={space.xs}>
          <Input.Search
            allowClear
            size="small"
            placeholder="课程 / 讲师 / 参与人员"
            style={{ width: 200 }}
            onSearch={(value) => patch({ keyword: value })}
          />
          <Select
            allowClear
            size="small"
            placeholder="课程是否满足发布要求"
            style={{ width: 200 }}
            options={conclusions}
            onChange={(value) => patch({ courseConclusion: value ?? null })}
          />
          <Select
            allowClear
            size="small"
            placeholder="讲师试讲是否合格"
            style={{ width: 180 }}
            options={conclusions}
            onChange={(value) => patch({ lecturerConclusion: value ?? null })}
          />
          <Select
            allowClear
            size="small"
            placeholder="记录状态"
            style={{ width: 130 }}
            options={selectOptions(recordStates)}
            onChange={(value) => patch({ recordState: value ?? null })}
          />
          <DatePicker.RangePicker
            size="small"
            placeholder={['试讲起', '试讲止']}
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
      <DataTable<TrialLedgerRow>
        storageKey="trial-ledger-course-align"
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
        error={page.isError ? '试讲台账没有取到。' : null}
        onReload={() => void page.refetch()}
        filtered={filtered}
        objectName="试讲记录"
        emptyDescription="试讲记录在课程详情页的试讲页签里建档，建档后会出现在这里。"
        onResetFilters={() => {
          setFilter({});
          setPageNum(1);
        }}
        onRowClick={(row) => onSelectLecturer(row.lecturerId)}
        activeRowKey={null}
        toolbarExtra={
          activeLecturerId !== null && (
            <Button
              size="small"
              type={filter.lecturerId ? 'primary' : 'default'}
              onClick={() =>
                patch({ lecturerId: filter.lecturerId ? null : activeLecturerId })
              }
            >
              {filter.lecturerId ? '看全部讲师' : '只看当前讲师'}
            </Button>
          )
        }
      />
    </AnalyticsCard>
  );
}

/**
 * 台账行的展开内容，讲师详情页的试讲记录页签复用它。
 *
 * <p>专家意见与问题清单是长文本，在表格里做成列会挤成两个字换一行；放展开区，需要时才看。
 */
export function TrialLedgerDetail({ row }: { row: TrialLedgerRow }) {
  return (
    <Descriptions
      size="small"
      column={1}
      items={[
        { key: 'satisfaction', label: '整体满意度', children: row.trialSatisfaction ?? '—' },
        { key: 'advice', label: '优化建议', children: row.trialOptimizeAdvice ?? '—' },
        { key: 'participants', label: '参与验收人员', children: row.participants ?? '—' },
        { key: 'opinion', label: '评审专家意见', children: row.expertOpinion ?? '—' },
        { key: 'issues', label: '问题清单', children: row.issueList ?? '—' },
      ]}
    />
  );
}
