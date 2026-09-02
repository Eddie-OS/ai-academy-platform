import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  App,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tag,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import dayjs from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { lecturerApi, type Lecturer, type LecturerFilter } from '@/shared/api/lecturers';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { AnalyticsRow, CockpitDetailPanel, CockpitLayout } from '@/shared/ui/CockpitLayout';
import { LECTURER_METRICS, mergeMetricValues } from '@/shared/metrics/cockpitMetrics';
import { metricsApi } from '@/shared/api/metrics';
import { PageState } from '@/shared/ui/PageState';
import { StatusTag } from '@/shared/ui/StatusTag';
import { formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';
import { useIsOperator } from '@/shared/store/authStore';
import { LecturerFormModal } from '@/features/lecturer/LecturerFormModal';
import { LecturerTabEdit } from '@/features/lecturer/LecturerTabEdit';
import { LecturerBasicInfo, lecturerBasicProfileOf } from '@/features/lecturer/LecturerBasicInfo';
import { LecturerTeachingTab } from '@/features/lecturer/LecturerTeachingTab';
import { LecturerEvaluationsTab } from '@/features/lecturer/LecturerEvaluationsTab';
import { LecturerTrialsTab } from '@/features/lecturer/LecturerTrialsTab';
import { LecturerCultivationTab } from '@/features/lecturer/LecturerCultivationTab';
import {
  LecturerCertTab,
  LecturerLevelLogTab,
  LecturerStateLogTab,
} from '@/features/lecturer/LecturerSnapshotTabs';
import { LecturerPoolDistribution } from '@/features/lecturer/LecturerPoolDistribution';
import { TrialLedgerTable } from '@/features/lecturer/TrialLedgerTable';
import {
  FIELD_ENUM_KEYS,
  selectOptions,
  useExpertiseDomains,
  useFieldEnums,
  useSourceDepts,
} from '@/features/lecturer/lecturerMeta';

/**
 * 驾驶舱三 · 讲师与能力地图（设计稿《讲师地图》）。
 *
 * <p>一屏装下需求文档 10.2 的三页：<b>P3-1 讲师池列表</b>是主区左列，<b>P3-2 讲师详情</b>的
 * 七个页签是右列面板，<b>P3-3 试讲台账</b>是底部分析区。
 *
 * <p><b>右侧面板没有可执行动作区。</b>另外四个驾驶舱的面板顶部都有一排转换按钮，讲师没有——
 * 培养状态与在池状态都不是状态机（规则 TS1、C10、需求 5.13），改值走「编辑」。
 * 「状态流转日志」页签展示上岗／培养／认证的操作审计时间轴，并写明不是状态机（TS2）。
 *
 * <p><b>侧栏叫「讲师与能力地图」，但这里不画能力地图。</b>讲师能力地图是二期的评估模型
 * （N6、原则三）。底部画的是已录数据的分布，不做任何打分与推荐。
 */
export function LecturerCockpitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const { message } = App.useApp();

  const [filter, setFilter] = useState<LecturerFilter>({});
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedId = Number(id);
  const hasSelection = Number.isFinite(selectedId) && selectedId > 0;

  useEffect(() => setExpanded(false), [id]);

  const fieldEnums = useFieldEnums();
  const domains = useExpertiseDomains();
  const sourceDepts = useSourceDepts();

  const page = useQuery({
    queryKey: ['lecturers', filter, pageNum, pageSize],
    queryFn: () => lecturerApi.page(filter, pageNum, pageSize),
  });

  const quantity = useQuery({
    queryKey: ['metrics', 'quantity', 'lecturers'],
    queryFn: () => metricsApi.quantity('lecturers'),
  });

  const detail = useQuery({
    queryKey: ['lecturers', selectedId, 'detail'],
    queryFn: () => lecturerApi.detail(selectedId),
    enabled: hasSelection,
  });

  const remove = useMutation({
    mutationFn: (lecturerId: number) => lecturerApi.remove(lecturerId),
    onSuccess: () => {
      message.success('讲师已删除');
      navigate('/lecturers');
      void queryClient.invalidateQueries({ queryKey: ['lecturers'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const patch = (next: Partial<LecturerFilter>) => {
    setFilter((current) => ({ ...current, ...next }));
    setPageNum(1);
  };

  const filtered = Object.values(filter).some(
    (value) => value !== null && value !== undefined && value !== '',
  );

  const select = (lecturerId: number) => navigate(`/lecturers/${lecturerId}`);

  const columns: DataTableColumn<Lecturer>[] = [
    { key: 'lecturerNo', title: '讲师ID', kind: 'code', dataIndex: 'lecturerNo', sortable: true },
    {
      key: 'lecturerName',
      title: '姓名',
      kind: 'person',
      sortable: true,
      render: (row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => select(row.id)}>
          {row.lecturerName}
        </Button>
      ),
    },
    { key: 'sourceDept', title: '来源部门', kind: 'dept', dataIndex: 'sourceDept' },
    {
      key: 'expertiseDomains',
      title: '擅长领域',
      kind: 'tags',
      // 自动入池的课程负责人这一项是空数组，交给 DataTable 统一渲染成「—」而不是一片空白
      render: (row) =>
        row.expertiseDomains.length === 0
          ? null
          : row.expertiseDomains.map((domain) => <Tag key={domain}>{domain}</Tag>),
    },
    {
      key: 'trainingState',
      title: '培养状态',
      kind: 'training',
      sortable: true,
      render: (row) => <StatusTag group="lecturerTraining" value={row.trainingState} />,
    },
    {
      key: 'trialQualified',
      title: '试讲合格',
      kind: 'statusSub',
      // 「否」不给标签：多数讲师还没试讲过，全挂灰标签会把已合格的那批淹掉
      render: (row) => (row.trialQualified ? <Tag color="success">已合格</Tag> : null),
    },
    {
      key: 'teachingCount',
      title: '累计授课',
      kind: 'number',
      sortable: true,
      render: (row) => (row.teachingCount === null ? null : `${row.teachingCount} 次`),
    },
    {
      key: 'avgScore',
      title: '平均评分',
      kind: 'number',
      sortable: true,
      // 无反馈时后端给 null，显示「—」而不是 0.0：「还没有人评过」与「大家都打 0 分」是两回事
      render: (row) => (row.avgScore === null ? null : `${row.avgScore} / 5`),
    },
    { key: 'poolState', title: '在池状态', kind: 'statusSub', dataIndex: 'poolState' },
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
        title="讲师与能力地图"
        subtitle="讲师池记录谁能讲、讲过什么、讲得怎么样。培养状态与在池状态由运营自由选择，不是状态机——改它们不写流转日志，也不影响任何效率指标。"
        actions={
          isOperator && (
            <Button type="primary" icon={<UserPlus size={15} />} onClick={() => setCreating(true)}>
              添加讲师
            </Button>
          )
        }
        metrics={mergeMetricValues(LECTURER_METRICS, quantity.data)}
        filters={
          <Space wrap size={space.xs}>
            <Input.Search
              allowClear
              placeholder="姓名 / 工号 / 授课方向"
              style={{ width: 220 }}
              onSearch={(value) => patch({ keyword: value })}
            />
            <Select
              allowClear
              showSearch
              placeholder="来源部门"
              style={{ width: 160 }}
              options={[
                ...domains.map((value) => ({ value, label: value })),
                ...(sourceDepts.data ?? [])
                  .filter((value) => !domains.includes(value))
                  .map((value) => ({ value, label: value })),
              ]}
              onChange={(value) => patch({ sourceDept: value ?? null })}
            />
            <Input
              allowClear
              placeholder="擅长领域"
              style={{ width: 160 }}
              onPressEnter={(event) =>
                patch({ expertiseDomain: (event.target as HTMLInputElement).value || null })
              }
              onBlur={(event) => patch({ expertiseDomain: event.target.value || null })}
            />
            <Select
              allowClear
              placeholder="培养状态"
              style={{ width: 120 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerTrainingState])}
              onChange={(value) => patch({ trainingState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="试讲合格标记"
              style={{ width: 140 }}
              options={[
                { value: 'true', label: '已试讲合格' },
                { value: 'false', label: '未试讲合格' },
              ]}
              onChange={(value) =>
                patch({ trialQualified: value === undefined ? null : value === 'true' })
              }
            />
            <Select
              allowClear
              placeholder="在池状态"
              style={{ width: 120 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerPoolState])}
              onChange={(value) => patch({ poolState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="入池方式"
              style={{ width: 180 }}
              options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerJoinType])}
              onChange={(value) => patch({ joinType: value ?? null })}
            />
            <DatePicker.RangePicker
              placeholder={['入池起', '入池止']}
              onChange={(range) =>
                patch({
                  joinedFrom: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null,
                  joinedTo: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null,
                })
              }
            />
            <Space.Compact>
              <InputNumber
                min={1}
                max={5}
                step={0.1}
                placeholder="评分下限"
                style={{ width: 110 }}
                onChange={(value) => patch({ scoreFrom: value === null ? null : String(value) })}
              />
              <InputNumber
                min={1}
                max={5}
                step={0.1}
                placeholder="评分上限"
                style={{ width: 110 }}
                onChange={(value) => patch({ scoreTo: value === null ? null : String(value) })}
              />
            </Space.Compact>
          </Space>
        }
        main={
          <DataTable<Lecturer>
            storageKey="lecturers"
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
            error={page.isError ? '讲师池没有取到。' : null}
            onReload={() => void page.refetch()}
            filtered={filtered}
            objectName="讲师"
            emptyDescription="讲师有三条入池路径：运营手动添加、批量导入、课程负责人在立项时自动入池。自动入池的讲师擅长领域与授课方向是空的，需要运营补齐。"
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
              onClose={() => navigate('/lecturers')}
              title={data?.lecturerName ?? '加载中'}
              titleExtra={
                data && (
                  <>
                    <Tag>{data.lecturerNo}</Tag>
                    <StatusTag group="lecturerTraining" value={data.trainingState} />
                    {data.trialQualified && <Tag color="success">试讲合格</Tag>}
                  </>
                )
              }
              meta={
                data && (
                  <>
                    最后修改 {formatDateTime(data.updatedAt)}
                    {data.updatedBy ? ` · ${data.updatedBy}` : ''}
                    {/* 讲师不参与三色灯：表上没有 last_state_changed_at，也没有「停滞」这回事 */}
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
                      title="删除这名讲师？"
                      description="上过课或试讲过的讲师不能删除。若只是不再安排授课，请改在池状态为「已移出」并填写移出原因——那条路径保留全部历史。"
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
            >
              {detail.isError ? (
                <PageState
                  variant="error"
                  description="这名讲师没有取到，可能已被删除。"
                  action={<Button onClick={() => navigate('/lecturers')}>回到讲师池</Button>}
                />
              ) : (
                <Tabs
                  size="small"
                  tabBarExtraContent={
                    isOperator && data ? <LecturerTabEdit onEdit={() => setEditing(true)} /> : null
                  }
                  items={[
                      { key: 'basic', label: '基本信息', children: data ? <BasicInfo lecturer={data} /> : null },
                      {
                        key: 'trials',
                        label: '试讲记录',
                        children: hasSelection ? <LecturerTrialsTab lecturerId={selectedId} /> : null,
                      },
                      {
                        key: 'cultivation',
                        label: '培养计划与培养记录',
                        children: data ? <LecturerCultivationTab lecturer={data} /> : null,
                      },
                      {
                        key: 'cert',
                        label: '认证记录',
                        children: data ? <LecturerCertTab lecturer={data} /> : null,
                      },
                      {
                        key: 'level',
                        label: '等级变更记录',
                        children: data ? <LecturerLevelLogTab lecturer={data} /> : null,
                      },
                      {
                        key: 'teaching',
                        label: '授课记录与学员反馈',
                        children: data ? (
                          <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
                            <LecturerTeachingTab lecturer={data} />
                            <LecturerEvaluationsTab lecturerId={data.id} />
                          </Space>
                        ) : null,
                      },
                      {
                        key: 'logs',
                        label: '状态流转日志',
                        children: data ? <LecturerStateLogTab lecturer={data} /> : null,
                      },
                    ]}
                  />
              )}
            </CockpitDetailPanel>
          )
        }
        analytics={
          <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
            <AnalyticsRow columns={1}>
              <TrialLedgerTable
                activeLecturerId={hasSelection ? selectedId : null}
                onSelectLecturer={select}
              />
            </AnalyticsRow>
            <AnalyticsRow columns={2}>
              <LecturerPoolDistribution />
            </AnalyticsRow>
          </Space>
        }
      />

      <LecturerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(newId) => {
          setCreating(false);
          void queryClient.invalidateQueries({ queryKey: ['lecturers'] });
          select(newId);
        }}
      />

      {data && (
        <LecturerFormModal
          open={editing}
          lecturer={data}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['lecturers'] });
          }}
        />
      )}
    </>
  );
}

/**
 * 基本信息页签（业务确认的基础档案口径 + 需求 10.3 只读项）。
 *
 * <p>入池方式、试讲合格标记与首次试讲合格时间只读：前一项由入池路径决定，后两项只能由
 * 试讲结论录入产生。建档时间可改，走编辑表单。
 */
function BasicInfo({ lecturer }: { lecturer: Lecturer }) {
  return <LecturerBasicInfo profile={lecturerBasicProfileOf(lecturer)} />;
}
