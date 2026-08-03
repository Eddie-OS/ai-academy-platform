import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { LayoutGrid, Pencil, Table2, Trash2 } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { caseApi, type CaseFilter, type CaseInfo } from '@/shared/api/cases';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { AnalyticsRow, CockpitDetailPanel, CockpitLayout } from '@/shared/ui/CockpitLayout';
import { CASE_METRICS } from '@/shared/metrics/cockpitMetrics';
import { PageState } from '@/shared/ui/PageState';
import { StatusTag } from '@/shared/ui/StatusTag';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import { useIsOperator } from '@/shared/store/authStore';
import { CaseAuditModal } from '@/features/kase/CaseAuditModal';
import { CaseBoard } from '@/features/kase/CaseBoard';
import { CaseContentTab } from '@/features/kase/CaseContentTab';
import { CaseFormModal } from '@/features/kase/CaseFormModal';
import { CaseGallery } from '@/features/kase/CaseGallery';
import { CaseInteractionTab } from '@/features/kase/CaseInteractionTab';
import { CaseReportsPanel } from '@/features/kase/CaseReportsPanel';
import { CaseTransitionPanel } from '@/features/kase/CaseTransitionPanel';
import {
  CASE_OBJECT_TYPE,
  CASE_STATE_FIELD,
  FIELD_ENUM_KEYS,
  selectOptions,
  useCaseDomains,
  useDomainNames,
  useEmployees,
  useFieldEnums,
  useStates,
} from '@/features/kase/caseMeta';

const { Text } = Typography;

/**
 * 驾驶舱五 · 案例图（需求第 12 章，设计稿《案例图》）。
 *
 * <p>一屏装下需求 12.2 的四页：<b>P5-2 案例列表</b>与 <b>P5-1 的卡片流</b>是主区左列的两种视图，
 * <b>P5-3 案例详情</b>的四个区块是右列面板，<b>P5-1 的统计图表</b>与 <b>P5-4 总结报告</b>是底部分析区。
 *
 * <p><b>页头没有「新建案例」。</b>案例只有一个来源：课程被标注达到精品标准时由后端自动创建
 * （议题 27、N10）。运营在这里做的是整理、审核、上架，不是录入。缺一条案例的正确做法是回到
 * 课程工作台把那门课标注达精品，而不是在这里补一条——补出来的案例没有来源课程，
 * 之后的每一张按课程口径统计的图都会少算它。
 *
 * <p><b>没有组织覆盖视图。</b>原 P5-4 随 N18 删除组织架构后整体推二期（N12），
 * 驾驶舱名也由「案例 + 组织覆盖图」改为「案例图」。
 */
export function CaseCockpitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const { message } = App.useApp();

  const [filter, setFilter] = useState<CaseFilter>({});
  const [view, setView] = useState<'卡片' | '列表'>('卡片');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [editing, setEditing] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedId = Number(id);
  const hasSelection = Number.isFinite(selectedId) && selectedId > 0;

  useEffect(() => setExpanded(false), [id]);

  const fieldEnums = useFieldEnums();
  const domains = useCaseDomains();
  const domainName = useDomainNames();
  const employees = useEmployees();
  const states = useStates(CASE_OBJECT_TYPE, CASE_STATE_FIELD);

  const page = useQuery({
    queryKey: ['cases', 'page', filter, pageNum, pageSize],
    queryFn: () => caseApi.page(filter, pageNum, pageSize),
  });

  const detail = useQuery({
    queryKey: ['cases', selectedId, 'detail'],
    queryFn: () => caseApi.detail(selectedId),
    enabled: hasSelection,
    // 详情接口每调一次就记一条浏览（需求 12.4）。窗口切回来自动重取会把浏览次数刷出假数
    refetchOnWindowFocus: false,
  });

  useReadDuration(selectedId, detail.data?.viewId ?? null);

  const remove = useMutation({
    mutationFn: (caseId: number) => caseApi.remove(caseId),
    onSuccess: () => {
      message.success('案例已删除');
      navigate('/cases');
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const patch = (next: Partial<CaseFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = Object.values(filter).some(
    (value) => value !== null && value !== undefined && value !== '',
  );

  const select = (caseId: number) => navigate(`/cases/${caseId}`);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['cases'] });
  };

  const columns: DataTableColumn<CaseInfo>[] = [
    { key: 'caseNo', title: '案例ID', kind: 'code', dataIndex: 'caseNo', sortable: true },
    {
      key: 'caseName',
      title: '案例名称',
      kind: 'name',
      sortable: true,
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => select(row.id)}>
          {row.caseName}
        </Button>
      ),
    },
    { key: 'courseName', title: '来源课程', kind: 'name', dataIndex: 'courseName' },
    { key: 'contributingOrg', title: '贡献组织', kind: 'dept', dataIndex: 'contributingOrg' },
    {
      key: 'domainCodes',
      title: '应用领域',
      kind: 'tags',
      render: (row) =>
        row.domainCodes.length === 0
          ? null
          : row.domainCodes.map((code) => <Tag key={code}>{domainName(code)}</Tag>),
    },
    {
      key: 'caseState',
      title: '案例状态',
      kind: 'statusMain',
      sortable: true,
      render: (row) => <StatusTag group="caseStatus" value={row.caseState} />,
    },
    {
      key: 'qualityMarks',
      title: '精品标注',
      kind: 'statusSub',
      render: (row) =>
        row.qualityMarks.length === 0
          ? null
          : row.qualityMarks.map((mark) => (
              <Tag key={mark} color="gold">
                {mark}
              </Tag>
            )),
    },
    { key: 'ownerName', title: '负责人', kind: 'person', dataIndex: 'ownerName' },
    { key: 'publishedAt', title: '上架时间', kind: 'date', dataIndex: 'publishedAt', sortable: true },
    { key: 'viewCount', title: '浏览', kind: 'number', dataIndex: 'viewCount', sortable: true },
    { key: 'likeCount', title: '点赞', kind: 'number', dataIndex: 'likeCount', sortable: true },
    { key: 'commentCount', title: '评论', kind: 'number', dataIndex: 'commentCount', sortable: true },
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
        title="案例图"
        subtitle="案例由课程达到精品标准时自动产生，运营在这里整理、审核、上架。平台记录案例被看了多少次、被点了多少赞，但不评估案例价值——那是二期的事。"
        actions={
          <Segmented
            value={view}
            onChange={(value) => setView(value as '卡片' | '列表')}
            options={[
              { value: '卡片', label: '卡片流', icon: <LayoutGrid size={14} /> },
              { value: '列表', label: '列表', icon: <Table2 size={14} /> },
            ]}
          />
        }
        metrics={CASE_METRICS}
        filters={
          <Space wrap size={space.xs}>
            <Input.Search
              allowClear
              placeholder="案例名称 / 正文"
              style={{ width: 220 }}
              onSearch={(value) => patch({ keyword: value })}
            />
            <Select
              allowClear
              placeholder="应用领域"
              style={{ width: 150 }}
              options={domains.map((item) => ({ value: item.code, label: item.name }))}
              onChange={(value) => patch({ domainCode: value ?? null })}
            />
            <Select
              allowClear
              placeholder="案例状态"
              style={{ width: 120 }}
              options={selectOptions(states)}
              onChange={(value) => patch({ caseState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="精品标注"
              style={{ width: 140 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.caseQualityMark])}
              onChange={(value) => patch({ qualityMark: value ?? null })}
            />
            <Input
              allowClear
              placeholder="贡献组织"
              style={{ width: 150 }}
              onChange={(e) => patch({ contributingOrg: e.target.value || null })}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="案例负责人"
              style={{ width: 180 }}
              options={(employees.data?.records ?? []).map((item) => ({
                value: item.employeeNo,
                label: `${item.employeeName}（${item.employeeNo}）`,
              }))}
              onChange={(value) => patch({ ownerNo: value ?? null })}
            />
            <DatePicker.RangePicker
              placeholder={['上架起', '上架止']}
              onChange={(range) =>
                patch({
                  publishedFrom: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null,
                  publishedTo: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null,
                })
              }
            />
            <Select
              placeholder="排序"
              style={{ width: 140 }}
              allowClear
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.caseBoardSort])}
              onChange={(value) => patch({ sortBy: value ?? null })}
            />
            <Space size={space['2xs']}>
              <Switch
                size="small"
                checked={filter.activeOnly === true}
                onChange={(checked) => patch({ activeOnly: checked ? true : null })}
              />
              {/* 末档即对外可见的那一档，取转换表的最后一个状态而不是把它的名字写在这里（STK-1） */}
              <Text style={{ fontSize: fontSize.bodySm, color: neutral[600] }}>
                只看{states.at(-1) ?? '对外可见'}
              </Text>
            </Space>
          </Space>
        }
        main={
          view === '卡片' ? (
            <CaseGallery
              rows={page.data?.records}
              loading={page.isLoading}
              error={page.isError}
              total={page.data?.total ?? 0}
              pageNum={pageNum}
              pageSize={pageSize}
              onPageChange={(nextPage, nextSize) => {
                setPageNum(nextPage);
                setPageSize(nextSize);
              }}
              onReload={() => void page.refetch()}
              onSelect={select}
              activeId={hasSelection ? selectedId : null}
            />
          ) : (
            <DataTable<CaseInfo>
              storageKey="cases"
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
              error={page.isError ? '案例没有取到。' : null}
              onReload={() => void page.refetch()}
              filtered={filtered}
              objectName="案例"
              emptyDescription="案例不能在这里新建。它的唯一来源是课程被标注达到精品标准——去课程工作台标注那门课，案例会自动出现在这里，落在流程的第一档。"
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
              onClose={() => navigate('/cases')}
              title={data?.caseName ?? '加载中'}
              titleExtra={
                data && (
                  <>
                    <Tag>{data.caseNo}</Tag>
                    <StatusTag group="caseStatus" value={data.caseState} />
                  </>
                )
              }
              meta={
                data && (
                  <>
                    最后修改 {formatDateTime(data.updatedAt)}
                    {data.updatedBy ? ` · ${data.updatedBy}` : ''}
                    {/* 状态最后变更时间与最后修改时间分开显示：改一个错别字不该看着像状态动过 */}
                    {data.lastStateChangedAt &&
                      ` · 状态最后变更 ${formatDateTime(data.lastStateChangedAt)}`}
                  </>
                )
              }
              actions={
                isOperator &&
                data && (
                  <Space size={space['2xs']}>
                    <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除这条案例？"
                      description="逻辑删除。案例是课程达精品的产物，删掉后再次标注那门课也不会重新生成——需要恢复请联系管理员。"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true, loading: remove.isPending }}
                      onConfirm={() => remove.mutate(data.id)}
                    >
                      <Button size="small" danger icon={<Trash2 size={14} />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              }
              stateArea={
                data && (
                  <CaseTransitionPanel caseInfo={data} onRequestAudit={() => setAuditing(true)} />
                )
              }
            >
              {detail.isError ? (
                <PageState
                  variant="error"
                  description="这条案例没有取到，可能已被删除。"
                  action={<Button onClick={() => navigate('/cases')}>回到案例列表</Button>}
                />
              ) : (
                <Tabs
                  size="small"
                  items={[
                    { key: 'basic', label: '基本信息', children: data ? <BasicInfo caseInfo={data} /> : null },
                    {
                      key: 'content',
                      label: '正文与附件',
                      children: data ? <CaseContentTab caseInfo={data} onSaved={refresh} /> : null,
                    },
                    {
                      key: 'audit',
                      label: '审核信息',
                      children: data ? (
                        <AuditInfo caseInfo={data} onRecord={() => setAuditing(true)} />
                      ) : null,
                    },
                    {
                      key: 'interaction',
                      label: '互动与评论',
                      children: hasSelection ? <CaseInteractionTab caseId={selectedId} /> : null,
                    },
                  ]}
                />
              )}
            </CockpitDetailPanel>
          )
        }
        analytics={
          <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
            <AnalyticsRow columns={3}>
              <CaseBoard />
            </AnalyticsRow>
            <AnalyticsRow columns={1}>
              <CaseReportsPanel />
            </AnalyticsRow>
          </Space>
        }
      />

      {data && (
        <>
          <CaseFormModal
            open={editing}
            caseInfo={data}
            onClose={() => setEditing(false)}
            onUpdated={() => {
              setEditing(false);
              refresh();
            }}
          />
          <CaseAuditModal
            open={auditing}
            caseInfo={data}
            onClose={() => setAuditing(false)}
            onRecorded={() => {
              setAuditing(false);
              refresh();
            }}
          />
        </>
      )}
    </>
  );
}

/**
 * 离开案例时回报本次停留时长（需求 12.4）。
 *
 * <p>用 {@code sendBeacon} 之外的普通请求：关闭标签页那一次确实会丢，但那不值得为它引一套
 * 信标上报——平均阅读时长是个参考量，不是考核指标。切到另一条案例、关闭面板、刷新页面
 * 这三种走法都会正常回报，它们占绝大多数。
 *
 * <p>超过 30 分钟的由后端截断：挂着页面去开会，那 3 小时不是阅读时长。
 */
function useReadDuration(caseId: number, viewId: number | null) {
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    if (viewId === null) {
      return undefined;
    }
    openedAt.current = Date.now();
    return () => {
      const started = openedAt.current;
      openedAt.current = null;
      if (started === null) {
        return;
      }
      const seconds = Math.round((Date.now() - started) / 1000);
      // 一秒都不到的多半是误点或路由抖动，不值得占一次请求
      if (seconds >= 1) {
        void caseApi.reportDuration(caseId, viewId, seconds).catch(() => undefined);
      }
    };
  }, [caseId, viewId]);
}

/**
 * 基本信息（需求 12.3 的字段清单）。
 *
 * <p>案例ID、来源课程、上架时间三项只读：它们分别由编号规则、自动创建、状态首次变更写入。
 * 上架时间尤其不能手填——它是案例周期的终点，能改就等于能改指标。
 */
function BasicInfo({ caseInfo }: { caseInfo: CaseInfo }) {
  const domainName = useDomainNames();

  return (
    <Card size="small" styles={{ body: { padding: space.sm } }}>
      <Descriptions
        column={1}
        size="small"
        styles={{ label: { color: neutral[600], width: 116, fontSize: fontSize.bodySm } }}
        items={[
          { key: 'no', label: '案例ID', children: caseInfo.caseNo },
          {
            key: 'course',
            label: '来源课程',
            children: caseInfo.courseName ?? EM_DASH,
          },
          { key: 'org', label: '贡献组织', children: caseInfo.contributingOrg },
          {
            key: 'contributors',
            label: '贡献人',
            children:
              caseInfo.contributors.length === 0
                ? EM_DASH
                : caseInfo.contributors.map((person) => <Tag key={person}>{person}</Tag>),
          },
          {
            key: 'domains',
            label: '应用领域',
            children:
              caseInfo.domainCodes.length === 0
                ? EM_DASH
                : caseInfo.domainCodes.map((code) => <Tag key={code}>{domainName(code)}</Tag>),
          },
          { key: 'owner', label: '案例负责人', children: caseInfo.ownerName ?? caseInfo.ownerNo },
          {
            key: 'marks',
            label: '精品标注',
            children:
              caseInfo.qualityMarks.length === 0
                ? EM_DASH
                : caseInfo.qualityMarks.map((mark) => (
                    <Tag key={mark} color="gold">
                      {mark}
                    </Tag>
                  )),
          },
          { key: 'expect', label: '预计上架日期', children: caseInfo.expectPublishDate ?? EM_DASH },
          {
            key: 'published',
            label: '上架时间',
            // 只记第一次：下架再上架不会把它往后推，它是案例周期的终点
            children: caseInfo.publishedAt ? formatDateTime(caseInfo.publishedAt) : EM_DASH,
          },
          { key: 'created', label: '创建时间', children: formatDateTime(caseInfo.createdAt) },
        ]}
      />
    </Card>
  );
}

/**
 * 审核信息（需求 12.3 第 9a～9d 项）。
 *
 * <p><b>只有一组，没有历史列表。</b>案例审核不记轮次（C09 第 4 条）——这一次录的结论直接覆盖
 * 上一次。与课程评审、需求验收都不一样，那两个每一轮都留档。
 */
function AuditInfo({ caseInfo, onRecord }: { caseInfo: CaseInfo; onRecord: () => void }) {
  const isOperator = useIsOperator();

  return (
    <Card
      size="small"
      styles={{ body: { padding: space.sm } }}
      extra={
        isOperator && (
          <Button size="small" onClick={onRecord}>
            录入审核结论
          </Button>
        )
      }
      title="审核结论"
    >
      {caseInfo.reviewResult === null ? (
        <Text style={{ color: neutral[600], fontSize: fontSize.bodySm }}>
          还没有审核结论。审核在线下进行，这里只登记结果——录入后案例会按结论上架，或退回上一档等运营改完再提交。
        </Text>
      ) : (
        <Descriptions
          column={1}
          size="small"
          styles={{ label: { color: neutral[600], width: 96, fontSize: fontSize.bodySm } }}
          items={[
            {
              key: 'reviewer',
              label: '审核人',
              children: caseInfo.reviewerName ?? caseInfo.reviewerNo ?? EM_DASH,
            },
            { key: 'reviewedAt', label: '审核时间', children: caseInfo.reviewedAt ?? EM_DASH },
            { key: 'result', label: '审核结论', children: <Tag>{caseInfo.reviewResult}</Tag> },
            {
              key: 'opinion',
              label: '审核意见',
              children: caseInfo.reviewOpinion ? (
                <Text style={{ whiteSpace: 'pre-wrap' }}>{caseInfo.reviewOpinion}</Text>
              ) : (
                EM_DASH
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
