import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Input, Select, Space, Tabs, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil } from 'lucide-react';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import {
  trainingApi,
  TRAINING_PLAN_OBJECT_TYPE,
  TRAINING_SESSION_OBJECT_TYPE,
  type TrainingPlan,
  type TrainingSession,
  type TrainingSessionFilter,
} from '@/shared/api/trainings';
import {
  AnalyticsCard,
  AnalyticsRow,
  CockpitDetailPanel,
  CockpitLayout,
} from '@/shared/ui/CockpitLayout';
import { TRAINING_METRICS } from '@/shared/metrics/cockpitMetrics';
import { PageState } from '@/shared/ui/PageState';
import { StateLogTab } from '@/shared/ui/StateLogTab';
import { formatDateTime, formatTime } from '@/shared/format';
import { useIsOperator } from '@/shared/store/authStore';
import { TrainingCalendarBoard } from '@/features/training/TrainingCalendarBoard';
import { TrainingPlanTable } from '@/features/training/TrainingPlanTable';
import { TrainingPlanFormModal } from '@/features/training/TrainingPlanFormModal';
import {
  TrainingSessionFormModal,
  useSchedulingWarnings,
} from '@/features/training/TrainingSessionFormModal';
import { TrainingTransitionPanel } from '@/features/training/TrainingTransitionPanel';
import { PlanSessionsTab } from '@/features/training/PlanSessionsTab';
import { SessionAttendeesTab } from '@/features/training/SessionAttendeesTab';
import { SessionArchiveTab } from '@/features/training/SessionArchiveTab';
import { SessionFeedbackTab } from '@/features/training/SessionFeedbackTab';
import {
  TRAINING_ENUM_KEYS,
  TRAINING_OBJECT_TYPE_CODES,
  TRAINING_STATE_FIELDS,
  selectOptions,
  useFieldEnums,
  useSchedulingOptions,
  useStates,
} from '@/features/training/trainingMeta';

const { Text } = Typography;

/**
 * 驾驶舱四 · 培训运营地图（设计稿《培训运营地图》）。
 *
 * <p>一屏装下需求文档 11.2／11.8／11.9 的四页：<b>P4-1 培训排期日历</b>是主区，
 * <b>P4-2 培训计划列表</b>在底部分析区，<b>P4-3 计划详情</b>与 <b>P4-4 场次详情</b>共用右列面板。
 *
 * <p><b>右列面板要认两种对象。</b>培训是全平台唯一的两级对象：计划定「面向谁、什么时间段、
 * 排几场」，场次定「哪天、谁讲、在哪」。设计稿主区铺的是场次日历，底部列的是计划，两边点开的
 * 不是同一类东西。做成两个面板并列会让右列挤到 230px；做成只认一种则底部那张计划表点了没反应。
 * 因此按路由前缀分流：{@code /training-plans/:id} 开计划面板，{@code /training-sessions/:id}
 * 开场次面板，同一时刻只有一个。
 *
 * <p><b>顶部筛选筛的是场次不是计划。</b>它驱动主区日历；计划表自带一组筛选，在它自己的卡片头上。
 * 两级对象的筛选条件（需求 11.8 与 11.9 各一张表）本就不是一套，硬合会让两边都筛不准。
 */

/** 右列面板当前认的是哪一级对象。由路由前缀决定，不由用户切换 */
type DetailKind = 'plan' | 'session' | null;

export function TrainingCockpitPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const showWarnings = useSchedulingWarnings();

  const [filter, setFilter] = useState<TrainingSessionFilter>({});
  const [planKeyword, setPlanKeyword] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selectedId = Number(id);
  const hasSelection = Number.isFinite(selectedId) && selectedId > 0;
  const kind: DetailKind = !hasSelection
    ? null
    : location.pathname.startsWith('/training-plans/')
      ? 'plan'
      : 'session';

  useEffect(() => setExpanded(false), [location.pathname]);

  const fieldEnums = useFieldEnums();
  const options = useSchedulingOptions();
  const sessionStates = useStates(TRAINING_OBJECT_TYPE_CODES.session, TRAINING_STATE_FIELDS.session);

  const plans = useQuery({
    queryKey: ['training-plans', 'calendar-filter', planKeyword],
    queryFn: () => trainingApi.plans({ keyword: planKeyword || null }, 1, 20),
  });

  const plan = useQuery({
    queryKey: ['training-plans', selectedId, 'detail'],
    queryFn: () => trainingApi.plan(selectedId),
    enabled: kind === 'plan',
  });

  const session = useQuery({
    queryKey: ['training-sessions', selectedId, 'detail'],
    queryFn: () => trainingApi.session(selectedId),
    enabled: kind === 'session',
  });

  const patch = (next: Partial<TrainingSessionFilter>) =>
    setFilter((current) => ({ ...current, ...next }));

  const selectPlan = (planId: number) => navigate(`/training-plans/${planId}`);
  const selectSession = (sessionId: number) => navigate(`/training-sessions/${sessionId}`);
  const closePanel = () => navigate('/trainings');

  return (
    <>
      <CockpitLayout
        title="培训运营地图"
        subtitle="日历上一格是一场培训。点日历卡片看场次，点底部计划表看计划，右侧面板换内容不跳页。签到与反馈都是线下发生后导入，平台不代为判断。"
        actions={
          isOperator && (
            <Button type="primary" icon={<CalendarDays size={15} />} onClick={() => setCreating(true)}>
              新建培训计划
            </Button>
          )
        }
        metrics={TRAINING_METRICS}
        filters={
          <Space wrap size={space.xs}>
            <Input.Search
              allowClear
              placeholder="场次ID / 名称"
              style={{ width: 220 }}
              onSearch={(value) => patch({ keyword: value })}
            />
            <Select
              allowClear
              showSearch
              filterOption={false}
              placeholder="所属计划"
              style={{ width: 220 }}
              onSearch={setPlanKeyword}
              notFoundContent={plans.isLoading ? '加载中' : '没有匹配的计划'}
              options={(plans.data?.records ?? []).map((item) => ({
                value: item.id,
                label: `${item.planName}（${item.planNo}）`,
              }))}
              onChange={(value) => patch({ planId: value ?? null })}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="关联课程"
              style={{ width: 200 }}
              options={(options.data?.courses ?? []).map((item) => ({
                value: item.id,
                label: `${item.courseName}（${item.courseNo}）`,
              }))}
              onChange={(value) => patch({ courseId: value ?? null })}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="授课讲师"
              style={{ width: 180 }}
              options={(options.data?.lecturers ?? []).map((item) => ({
                value: item.id,
                label: `${item.lecturerName}（${item.lecturerNo}）`,
              }))}
              onChange={(value) => patch({ lecturerId: value ?? null })}
            />
            <Select
              allowClear
              placeholder="场次状态"
              style={{ width: 130 }}
              options={selectOptions(sessionStates)}
              onChange={(value) => patch({ sessionState: value ?? null })}
            />
            <Select
              allowClear
              placeholder="培训形式"
              style={{ width: 120 }}
              options={selectOptions(fieldEnums.data?.[TRAINING_ENUM_KEYS.trainingForm])}
              onChange={(value) => patch({ trainingForm: value ?? null })}
            />
          </Space>
        }
        main={
          <TrainingCalendarBoard
            filter={filter}
            onSelectSession={selectSession}
            activeSessionId={kind === 'session' ? selectedId : null}
          />
        }
        detailExpanded={expanded}
        detail={
          kind === 'plan' ? (
            <PlanPanel
              planId={selectedId}
              plan={plan.data}
              failed={plan.isError}
              expanded={expanded}
              onToggleExpand={() => setExpanded((value) => !value)}
              onClose={closePanel}
              onEdit={() => setEditing(true)}
            />
          ) : kind === 'session' ? (
            <SessionPanel
              sessionId={selectedId}
              session={session.data}
              failed={session.isError}
              expanded={expanded}
              onToggleExpand={() => setExpanded((value) => !value)}
              onClose={closePanel}
              onEdit={() => setEditing(true)}
              onOpenPlan={selectPlan}
            />
          ) : (
            false
          )
        }
        analytics={
          // 计划表吃宽度：十列里有「计划起止日期」与「计划/实际场次数」两列不能省略
          <AnalyticsRow columns="minmax(0, 3fr) minmax(0, 2fr)">
            <TrainingPlanTable
              onSelectPlan={selectPlan}
              activePlanId={kind === 'plan' ? selectedId : null}
            />
            <AnalyticsCard
              title="数据概览"
              note="设计稿这块放的是签到完成率、学员反馈均分与今日提醒，三项都属阶段 3 的 54 个指标"
            >
              <PageState
                variant="empty"
                objectName="培训指标"
                description="签到完成率、本月参训人次、学员反馈平均分由阶段 3 的 aggregate/metrics 统一计算。此刻在这里现算一遍，等口径与阈值配置上线后会有两套数字，而其中一套不受配置影响。"
              />
            </AnalyticsCard>
          </AnalyticsRow>
        }
      />

      <TrainingPlanFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(newId) => {
          setCreating(false);
          selectPlan(newId);
        }}
      />

      {kind === 'plan' && plan.data && (
        <TrainingPlanFormModal
          open={editing}
          plan={plan.data}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['training-plans'] });
          }}
        />
      )}

      {kind === 'session' && session.data && (
        <TrainingSessionFormModal
          open={editing}
          planId={session.data.planId}
          session={session.data}
          onClose={() => setEditing(false)}
          onSaved={(result) => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
            showWarnings(result.warnings);
          }}
        />
      )}
    </>
  );
}

/** P4-3 培训计划详情（需求 11.2：基本信息 / 下属场次）。状态流转日志另加一个页签，见下。 */
function PlanPanel({
  planId,
  plan,
  failed,
  expanded,
  onToggleExpand,
  onClose,
  onEdit,
}: {
  planId: number;
  plan: TrainingPlan | undefined;
  failed: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const isOperator = useIsOperator();

  return (
    <CockpitDetailPanel
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onClose={onClose}
      title={plan?.planName ?? '加载中'}
      titleExtra={
        plan && (
          <>
            <Tag>{plan.planNo}</Tag>
            <Tag color="blue">{plan.planState}</Tag>
          </>
        )
      }
      meta={
        plan && (
          <>
            最后修改 {formatDateTime(plan.updatedAt)}
            {plan.updatedBy ? ` · ${plan.updatedBy}` : ''}
            {plan.lastStateChangedAt
              ? ` · 状态最后变更于 ${formatDateTime(plan.lastStateChangedAt)}`
              : ''}
          </>
        )
      }
      actions={
        isOperator &&
        plan && (
          <Button size="small" icon={<Pencil size={14} />} onClick={onEdit}>
            编辑
          </Button>
        )
      }
      stateArea={
        plan && (
          <TrainingTransitionPanel
            objectType={TRAINING_PLAN_OBJECT_TYPE}
            objectId={planId}
            invalidateKey="training-plans"
          />
        )
      }
    >
      {failed ? (
        <PageState
          variant="error"
          description="这个培训计划没有取到，可能已被删除。"
          action={<Button onClick={onClose}>回到培训运营地图</Button>}
        />
      ) : (
        <Tabs
          size="small"
          items={[
            { key: 'basic', label: '基本信息', children: plan ? <PlanBasicInfo plan={plan} /> : null },
            {
              key: 'sessions',
              label: `下属场次${plan ? `（${plan.actualSessionCount}）` : ''}`,
              children: plan ? <PlanSessionsTab planId={planId} courseId={plan.courseId} /> : null,
            },
            {
              // 不在需求 11.2 列的两个页签里，但每个带状态的对象都要有「它经历了什么」的去处
              // （需求 5.11），否则运营只能去操作审计日志里翻
              key: 'logs',
              label: '状态流转日志',
              children: <StateLogTab objectType={TRAINING_PLAN_OBJECT_TYPE} objectId={planId} />,
            },
          ]}
        />
      )}
    </CockpitDetailPanel>
  );
}

/** P4-4 培训场次详情（需求 11.2：基本信息 / 参训人员与签到 / 培训归档 / 学员反馈）。 */
function SessionPanel({
  sessionId,
  session,
  failed,
  expanded,
  onToggleExpand,
  onClose,
  onEdit,
  onOpenPlan,
}: {
  sessionId: number;
  session: TrainingSession | undefined;
  failed: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onEdit: () => void;
  onOpenPlan: (planId: number) => void;
}) {
  const isOperator = useIsOperator();

  return (
    <CockpitDetailPanel
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onClose={onClose}
      title={session?.sessionName ?? session?.sessionNo ?? '加载中'}
      titleExtra={
        session && (
          <>
            <Tag>{session.sessionNo}</Tag>
            <Tag color="blue">{session.sessionState}</Tag>
            <Tag>{session.trainingForm}</Tag>
          </>
        )
      }
      meta={
        session && (
          <>
            {session.trainingDate} {formatTime(session.startTime)} - {formatTime(session.endTime)} ·
            最后修改{' '}
            {formatDateTime(session.updatedAt)}
            {session.lastStateChangedAt
              ? ` · 状态最后变更于 ${formatDateTime(session.lastStateChangedAt)}`
              : ''}
          </>
        )
      }
      actions={
        isOperator &&
        session && (
          <Button size="small" icon={<Pencil size={14} />} onClick={onEdit}>
            编辑
          </Button>
        )
      }
      stateArea={
        session && (
          <TrainingTransitionPanel
            objectType={TRAINING_SESSION_OBJECT_TYPE}
            objectId={sessionId}
            invalidateKey="training-sessions"
          />
        )
      }
    >
      {failed ? (
        <PageState
          variant="error"
          description="这个培训场次没有取到，可能已被删除。"
          action={<Button onClick={onClose}>回到培训运营地图</Button>}
        />
      ) : (
        <Tabs
          size="small"
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: session ? <SessionBasicInfo session={session} onOpenPlan={onOpenPlan} /> : null,
            },
            {
              key: 'attendees',
              label: '参训人员与签到',
              children: <SessionAttendeesTab sessionId={sessionId} />,
            },
            { key: 'archive', label: '培训归档', children: <SessionArchiveTab sessionId={sessionId} /> },
            { key: 'feedbacks', label: '学员反馈', children: <SessionFeedbackTab sessionId={sessionId} /> },
            {
              key: 'logs',
              label: '状态流转日志',
              children: <StateLogTab objectType={TRAINING_SESSION_OBJECT_TYPE} objectId={sessionId} />,
            },
          ]}
        />
      )}
    </CockpitDetailPanel>
  );
}

/** 面板宽 460px，描述列表用一列：两列会让「计划/实际场次数」这类标签换行，标签一换行就读不出对应关系。 */
function PlanBasicInfo({ plan }: { plan: TrainingPlan }) {
  return (
    <Card size="small" styles={{ body: { padding: space.sm } }}>
      <Descriptions
        column={1}
        size="small"
        styles={{ label: { color: neutral[600], width: 116, fontSize: fontSize.bodySm } }}
        items={[
          { key: 'no', label: '计划ID', children: plan.planNo },
          { key: 'course', label: '关联课程', children: plan.courseName ?? '—' },
          { key: 'owner', label: '培训负责人', children: plan.ownerName ?? plan.ownerNo },
          { key: 'start', label: '计划开始日期', children: plan.planStartDate },
          { key: 'end', label: '计划结束日期', children: plan.planEndDate },
          {
            key: 'count',
            label: '计划/实际场次数',
            // 计划场次数留空是常态（还没定），显示成「0/3」会读成「一场都没排」
            children:
              plan.planSessionCount === null
                ? `未定 / ${plan.actualSessionCount}`
                : `${plan.planSessionCount} / ${plan.actualSessionCount}`,
          },
          { key: 'finish', label: '实际完成日期', children: plan.actualFinishDate ?? '—' },
          {
            key: 'scope',
            label: '面向人群范围',
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{plan.targetScope}</Text>,
          },
          {
            key: 'remark',
            label: '备注',
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{plan.remark ?? '—'}</Text>,
          },
        ]}
      />
    </Card>
  );
}

function SessionBasicInfo({
  session,
  onOpenPlan,
}: {
  session: TrainingSession;
  onOpenPlan: (planId: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <Card size="small" styles={{ body: { padding: space.sm } }}>
      <Descriptions
        column={1}
        size="small"
        styles={{ label: { color: neutral[600], width: 116, fontSize: fontSize.bodySm } }}
        items={[
          { key: 'no', label: '场次ID', children: session.sessionNo },
          {
            key: 'plan',
            label: '所属计划',
            children: (
              <Button type="link" style={{ padding: 0 }} onClick={() => onOpenPlan(session.planId)}>
                {session.planName}（{session.planNo}）
              </Button>
            ),
          },
          {
            key: 'course',
            label: '关联课程',
            children: (
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() => navigate(`/courses/${session.courseId}`)}
              >
                {session.courseName ?? `课程 #${session.courseId}`}
              </Button>
            ),
          },
          {
            key: 'lecturer',
            label: '授课讲师',
            children: session.lecturerName ?? `讲师 #${session.lecturerId}`,
          },
          { key: 'date', label: '培训日期', children: session.trainingDate },
          {
            key: 'time',
            label: '培训时间',
            children: `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`,
          },
          {
            key: 'duration',
            label: '培训时长',
            children: session.durationHours ? `${session.durationHours} 小时` : '—',
          },
          { key: 'form', label: '培训形式', children: session.trainingForm },
          { key: 'venue', label: '培训地点', children: session.venue ?? '—' },
          {
            key: 'link',
            label: '线上链接',
            children: session.onlineLink ? (
              <a href={session.onlineLink} target="_blank" rel="noreferrer">
                {session.onlineLink}
              </a>
            ) : (
              '—'
            ),
          },
          { key: 'planCount', label: '计划人数', children: session.planAttendeeCount ?? '—' },
          {
            key: 'actualCount',
            label: '实际签到人数',
            // 没导入签到不是 0 人到场：签到是线下发生后导入的，未导入时给不出人数
            children: session.attendanceImported ? session.actualAttendeeCount : '尚未导入签到',
          },
          {
            key: 'scope',
            label: '学员范围',
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{session.studentScope}</Text>,
          },
          {
            key: 'remark',
            label: '备注',
            children: <Text style={{ whiteSpace: 'pre-wrap' }}>{session.remark ?? '—'}</Text>,
          },
        ]}
      />
    </Card>
  );
}
