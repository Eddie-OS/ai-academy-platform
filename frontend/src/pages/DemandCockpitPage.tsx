import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Input,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import { DEMAND_OBJECT_TYPE, demandApi, type Demand, type DemandFilter } from '@/shared/api/demands';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { AnalyticsRow, CockpitDetailPanel, CockpitLayout } from '@/shared/ui/CockpitLayout';
import { DEMAND_METRICS } from '@/shared/metrics/cockpitMetrics';
import { PageState } from '@/shared/ui/PageState';
import { StateLogTab } from '@/shared/ui/StateLogTab';
import { DemandFormModal } from '@/features/demand/DemandFormModal';
import { DemandTransitionPanel } from '@/features/demand/DemandTransitionPanel';
import { DemandReviewsTab } from '@/features/demand/DemandReviewsTab';
import { DemandOutletTab } from '@/features/demand/DemandOutletTab';
import { DemandAcceptanceTab } from '@/features/demand/DemandAcceptanceTab';
import { DemandCoursesTab } from '@/features/demand/DemandCoursesTab';
import { DemandDistribution } from '@/features/demand/DemandDistribution';
import {
  DEMAND_OBJECT_TYPE_CODE,
  DEMAND_STATE_FIELDS,
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
  useMachines,
} from '@/features/demand/demandMeta';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';

const { Text } = Typography;

/**
 * 驾驶舱一 · AI需求（设计稿《AI需求驾驶舱》）。
 *
 * <p>一屏装下需求文档 8.2 的三页：<b>P1-1 需求列表</b>是主区左列，<b>P1-2 需求详情</b>的七个
 * 页签是右列面板，<b>P1-3 需求态势图</b>是底部分析区。合并的理由见 {@code CockpitLayout} 的注释。
 *
 * <p><b>选中一条不改地址栏之外的任何东西。</b>点行 → {@code navigate('/demands/123')}，
 * 面板从 URL 的 id 读，不另存一份 state。这样刷新、后退、复制链接三件事都不用单独处理，
 * 而「列表选中态」与「面板显示的对象」也不可能对不上——它们读的是同一个值。
 */
export function DemandCockpitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();

  const [filter, setFilter] = useState<DemandFilter>({});
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedId = Number(id);
  const hasSelection = Number.isFinite(selectedId) && selectedId > 0;

  // 换一条对象时收回展开态：上一条为了看签到名单展开过，下一条多半只想看基本信息
  useEffect(() => setExpanded(false), [id]);

  const fieldEnums = useFieldEnums();
  const dicts = useDicts();
  const machines = useMachines();
  const employees = useEmployees();

  const page = useQuery({
    queryKey: ['demands', filter, pageNum, pageSize],
    queryFn: () => demandApi.page(filter, pageNum, pageSize),
  });

  const detail = useQuery({
    queryKey: ['demands', selectedId, 'detail'],
    queryFn: () => demandApi.detail(selectedId),
    enabled: hasSelection,
  });

  const demandMachines = useMemo(
    () => (machines.data ?? []).filter((m) => m.objectType === DEMAND_OBJECT_TYPE_CODE),
    [machines.data],
  );
  const statesOf = (stateField: string) =>
    demandMachines.find((m) => m.stateField === stateField)?.states ?? [];

  const patch = (next: Partial<DemandFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = Object.values(filter).some(
    (value) => value !== null && value !== undefined && value !== '',
  );

  const select = (demandId: number) => navigate(`/demands/${demandId}`);

  const columns: DataTableColumn<Demand>[] = [
    { key: 'demandNo', title: '需求ID', kind: 'code', dataIndex: 'demandNo', sortable: true },
    {
      key: 'demandName',
      title: '需求名称',
      kind: 'name',
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => select(row.id)}>
          {row.demandName}
        </Button>
      ),
    },
    { key: 'domainCode', title: '所属领域', kind: 'combatUnit', dataIndex: 'domainCode' },
    { key: 'ownerName', title: '负责人', kind: 'person', dataIndex: 'ownerName' },
    { key: 'reviewState', title: '评审状态', kind: 'statusMain', dataIndex: 'reviewState' },
    { key: 'outlet', title: '分流出口', kind: 'tags', dataIndex: 'outlet' },
    {
      key: 'currentProcessState',
      title: '当前处理状态',
      kind: 'statusSub',
      dataIndex: 'currentProcessState',
    },
    { key: 'acceptanceState', title: '业务验收状态', kind: 'statusSub', dataIndex: 'acceptanceState' },
    {
      key: 'expectFinishDate',
      title: '预计完成时间',
      kind: 'date',
      dataIndex: 'expectFinishDate',
      sortable: true,
    },
    {
      key: 'warningLight',
      title: '灯色',
      kind: 'light',
      // 留位不填值：阶段 3 的 aggregate/warning 落地后换成后端给的灯色与天数。
      // 此刻渲染成「健康」是在替后端下结论——一条逾期两个月的需求会被标成健康
      render: () => null,
    },
    {
      key: 'courseCount',
      title: '关联课程',
      kind: 'number',
      render: (row) => (row.courseCount ? <Tag>{row.courseCount} 门</Tag> : null),
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
        title="AI需求"
        subtitle="点列表任一行在右侧展开该需求的七个页签。状态一律由运营手动流转，平台只记录线下已经发生的事。"
        actions={
          isOperator && (
            <Button type="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              登记需求
            </Button>
          )
        }
        metrics={DEMAND_METRICS}
        filters={
          <Space wrap size={space.xs}>
            <Input.Search
              allowClear
              placeholder="需求ID / 名称 / 描述"
              style={{ width: 240 }}
              onSearch={(value) => patch({ keyword: value })}
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
              placeholder="评审状态"
              style={{ width: 130 }}
              options={selectOptions(statesOf(DEMAND_STATE_FIELDS.review))}
              onChange={(value) => patch({ reviewState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="分流出口"
              style={{ width: 180 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandOutlet])}
              onChange={(value) => patch({ outlet: value ?? null })}
            />
            <Select
              allowClear
              placeholder="解决方案状态"
              style={{ width: 140 }}
              options={selectOptions(statesOf(DEMAND_STATE_FIELDS.solution))}
              onChange={(value) => patch({ solutionState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="需求开发状态"
              style={{ width: 140 }}
              options={selectOptions(statesOf(DEMAND_STATE_FIELDS.dev))}
              onChange={(value) => patch({ devState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="业务验收状态"
              style={{ width: 140 }}
              options={selectOptions(statesOf(DEMAND_STATE_FIELDS.acceptance))}
              onChange={(value) => patch({ acceptanceState: value ?? null })}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="负责人"
              style={{ width: 160 }}
              options={(employees.data?.records ?? []).map((item) => ({
                value: item.employeeNo,
                label: `${item.employeeName}（${item.employeeNo}）`,
              }))}
              onChange={(value) => patch({ ownerNo: value ?? null })}
            />
            <DatePicker.RangePicker
              placeholder={['提出起', '提出止']}
              onChange={(range) =>
                patch({
                  proposedFrom: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null,
                  proposedTo: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null,
                })
              }
            />
            <DatePicker.RangePicker
              placeholder={['预计完成起', '预计完成止']}
              onChange={(range) =>
                patch({
                  expectFinishFrom: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null,
                  expectFinishTo: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null,
                })
              }
            />
            <Select
              allowClear
              placeholder="关联课程"
              style={{ width: 130 }}
              options={[
                { value: 'true', label: '有关联课程' },
                { value: 'false', label: '无关联课程' },
              ]}
              onChange={(value) => patch({ hasCourse: value === undefined ? null : value === 'true' })}
            />
          </Space>
        }
        main={
          <DataTable<Demand>
            storageKey="demands"
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
            error={page.isError ? '需求列表没有取到。' : null}
            onReload={() => void page.refetch()}
            filtered={filtered}
            objectName="需求"
            emptyDescription="需求从「登记」开始，线下评审有结论后再回来录入结论与分流出口。"
            onResetFilters={() => {
              setFilter({});
              setPageNum(1);
            }}
            onRowClick={(row) => select(row.id)}
            activeRowKey={hasSelection ? String(selectedId) : null}
          />
        }
        detailExpanded={expanded}
        detail={
          hasSelection && (
          <CockpitDetailPanel
            expanded={expanded}
            onToggleExpand={() => setExpanded((value) => !value)}
            onClose={() => navigate('/demands')}
            title={data?.demandName ?? '加载中'}
            titleExtra={
              data && (
                <>
                  <Tag>{data.demandNo}</Tag>
                  <Tag color="blue">{data.reviewState}</Tag>
                  {data.priority && <Tag>优先级 {data.priority}</Tag>}
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
            stateArea={data && <DemandTransitionPanel demand={data} />}
          >
            {detail.isError ? (
              <PageState
                variant="error"
                description="这条需求没有取到，可能已被删除。"
                action={<Button onClick={() => navigate('/demands')}>回到需求列表</Button>}
              />
            ) : (
              <Tabs
                size="small"
                items={[
                  { key: 'basic', label: '基本信息', children: data ? <BasicInfo demand={data} /> : null },
                  { key: 'review', label: '评审信息', children: data ? <DemandReviewsTab demand={data} /> : null },
                  { key: 'outlet', label: '分流与处理', children: data ? <DemandOutletTab demand={data} /> : null },
                  { key: 'acceptance', label: '业务验收', children: data ? <DemandAcceptanceTab demand={data} /> : null },
                  { key: 'courses', label: '关联课程', children: hasSelection ? <DemandCoursesTab demandId={selectedId} /> : null },
                  {
                    key: 'escalations',
                    label: '催办记录',
                    children: (
                      <PageState
                        variant="empty"
                        objectName="催办记录"
                        description="催办台账属于阶段 4，尚未上线。一期系统不发送任何消息，催办是线下动作，平台只记录催了谁、催的什么、什么时候催的。"
                      />
                    ),
                  },
                  {
                    key: 'logs',
                    label: '状态流转日志',
                    children: hasSelection ? (
                      <StateLogTab objectType={DEMAND_OBJECT_TYPE} objectId={selectedId} />
                    ) : null,
                  },
                ]}
              />
            )}
          </CockpitDetailPanel>
          )
        }
        analytics={
          <AnalyticsRow columns={3}>
            <DemandDistribution />
          </AnalyticsRow>
        }
      />

      <DemandFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(newId) => {
          setCreating(false);
          select(newId);
        }}
      />

      {data && (
        <DemandFormModal
          open={editing}
          demand={data}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['demands'] });
          }}
        />
      )}
    </>
  );
}

/**
 * 基本信息页签。面板只有 460px 宽，描述列表用一列而不是两列——两列在这个宽度下
 * 「预计开发完成时间」这类标签会换行，标签换行后值与标签的对应关系就读不出来了。
 */
function BasicInfo({ demand }: { demand: Demand }) {
  return (
    <Card size="small" styles={{ body: { padding: space.sm } }}>
      <Descriptions
        column={1}
        size="small"
        styles={{ label: { color: neutral[600], width: 116, fontSize: fontSize.bodySm } }}
        items={[
          { key: 'no', label: '需求ID', children: demand.demandNo },
          { key: 'domain', label: '所属领域', children: demand.domainCode },
          { key: 'proposer', label: '需求提出人', children: demand.proposerName ?? demand.proposerNo },
          {
            key: 'dept',
            label: '提出人部门',
            // 随提出人带出的快照：人员调岗后这条需求仍显示当初的部门
            children: demand.proposerDept ?? '—',
          },
          { key: 'owner', label: '负责人', children: demand.ownerName ?? demand.ownerNo },
          { key: 'proposed', label: '提出时间', children: demand.proposedDate },
          { key: 'expect', label: '预计开发完成时间', children: demand.expectFinishDate },
          { key: 'source', label: '需求来源', children: demand.demandSource ?? '—' },
          { key: 'type', label: '需求类型', children: demand.demandType ?? '—' },
          { key: 'priority', label: '优先级', children: demand.priority ?? '—' },
          { key: 'courses', label: '关联课程数', children: demand.courseCount ?? 0 },
          {
            key: 'lastState',
            label: '最后状态变更',
            children: formatDateTime(demand.lastStateChangedAt),
          },
          {
            key: 'description',
            label: '需求描述',
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{demand.description}</Text>,
          },
        ]}
      />
    </Card>
  );
}
