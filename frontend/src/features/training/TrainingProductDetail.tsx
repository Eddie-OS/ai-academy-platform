import { useEffect, useState, type ReactNode } from 'react';
import { Button, Modal, Spin } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { TRAINING_PRODUCT_DETAIL_TABS } from '@/fixtures/training';
import { trainingApi, type TrainingPlan, type TrainingSession } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { TrainingPlanFormModal } from './TrainingPlanFormModal';
import { TrainingProductSessions } from './TrainingProductSessions';
import { TrainingProductAttendees } from './TrainingProductAttendees';
import { TrainingProductArchive } from './TrainingProductArchive';
import { TrainingProductFeedback } from './TrainingProductFeedback';
import './trainingPlanFormModal.css';
import './TrainingProductDetail.css';

type ProductTab = (typeof TRAINING_PRODUCT_DETAIL_TABS)[number];

/**
 * 产品模式培训详情：五子页，基本信息与「新建培训计划」同一套字段。
 *
 * <p>实际完成场次、实际参训人数不手填，由本计划下属场次实时汇总。
 * 参训学员／归档／反馈仍按场次取数，默认打开日历点进来的那一场，可在场次记录里改。
 */

interface TrainingProductDetailProps {
  sessionId?: string | null;
  planId?: number | null;
  initialTab?: ProductTab;
  onClose: () => void;
}

export function TrainingProductDetail({
  sessionId,
  planId: openedPlanId,
  initialTab,
  onClose,
}: TrainingProductDetailProps) {
  const queryClient = useQueryClient();
  const numericId = Number(sessionId);
  const liveSession = Number.isFinite(numericId) && numericId > 0;
  const [tab, setTab] = useState<ProductTab>(initialTab ?? '基本信息');
  const [focusSessionId, setFocusSessionId] = useState<number | null>(liveSession ? numericId : null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setTab(initialTab ?? '基本信息');
    setFocusSessionId(liveSession ? numericId : null);
  }, [liveSession, numericId, openedPlanId, initialTab]);

  const session = useQuery({
    queryKey: ['training-sessions', numericId],
    queryFn: () => trainingApi.session(numericId),
    enabled: liveSession,
  });
  const planId = openedPlanId ?? session.data?.planId;
  const hasTarget = liveSession || openedPlanId != null;
  const plan = useQuery({
    queryKey: ['training-plans', planId],
    queryFn: () => trainingApi.plan(planId!),
    enabled: planId != null,
  });
  const planSessions = useQuery({
    queryKey: ['training-sessions', 'of-plan', planId],
    queryFn: () => trainingApi.sessions({ planId }, 1, 200),
    enabled: planId != null,
  });

  const rows = planSessions.data?.records ?? [];
  const attendeeTotal = planSessions.isSuccess
    ? rows.reduce((sum, row) => sum + (row.actualAttendeeCount ?? 0), 0)
    : null;
  const lecturers = planSessions.isSuccess ? uniqueLecturers(rows) : '—';
  const activeSessionId = focusSessionId ?? (liveSession ? numericId : null);

  return (
    <>
    <Modal
      open
      title={
        session.data?.courseName
        ?? plan.data?.courseName
        ?? plan.data?.planName
        ?? '培训详情'
      }
      footer={null}
      centered
      width={1100}
      className="training-plan-form-modal"
      rootClassName="training-plan-form-modal-root training-product-detail-root"
      destroyOnHidden
      onCancel={onClose}
    >
      <div className="trn-prod-shell" data-testid="product-training-detail">
        <nav className="trn-prod-tabs" aria-label="培训详情页签">
          {TRAINING_PRODUCT_DETAIL_TABS.map((item) => (
            <button
              key={item}
              type="button"
              className="trn-prod-tab"
              data-testid="product-training-tab"
              data-active={item === tab}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="trn-prod-body">
          {!hasTarget ? (
            <p className="trn-prod-empty">这条场次没有可查询的计划编号，无法打开详情。</p>
          ) : (liveSession && session.isLoading) || (planId != null && plan.isLoading) ? (
            <div className="trn-prod-loading">
              <Spin />
            </div>
          ) : liveSession && session.isError ? (
            <p className="trn-prod-empty">没有取到这场培训，可能已被删除。</p>
          ) : plan.isError || !plan.data ? (
            <p className="trn-prod-empty">没有取到这条培训计划，可能已被删除。</p>
          ) : (
            <ProductTabBody
              tab={tab}
              plan={plan.data}
              attendeeTotal={attendeeTotal}
              lecturers={lecturers}
              session={rows.find((row) => row.id === activeSessionId) ?? session.data ?? null}
              sessionId={activeSessionId}
              onSelectSession={(row) => setFocusSessionId(row.id)}
              onEditPlan={() => setEditing(true)}
            />
          )}
        </div>
      </div>
    </Modal>
      {editing && plan.data ? (
        <TrainingPlanFormModal
          open={editing}
          plan={plan.data}
          onClose={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['training-plans'] });
            void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
          }}
          onDeleted={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['training-plans'] });
            void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
            void queryClient.invalidateQueries({ queryKey: ['metrics'] });
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

function ProductTabBody({
  tab,
  plan,
  attendeeTotal,
  lecturers,
  session,
  sessionId,
  onSelectSession,
  onEditPlan,
}: {
  tab: ProductTab;
  plan: TrainingPlan;
  attendeeTotal: number | null;
  lecturers: string;
  session: TrainingSession | null;
  sessionId: number | null;
  onSelectSession: (session: TrainingSession) => void;
  onEditPlan: () => void;
}) {
  if (tab === '基本信息') {
    return (
      <BasicInfoFields
        plan={plan}
        attendeeTotal={attendeeTotal}
        lecturers={lecturers}
        onEdit={onEditPlan}
      />
    );
  }
  if (tab === '培训场次记录') {
    return (
      <TrainingProductSessions
        planId={plan.id}
        courseId={plan.courseId}
        selectedSessionId={sessionId ?? undefined}
        onSelectSession={onSelectSession}
      />
    );
  }
  if (sessionId == null) {
    return <p className="trn-prod-empty">先在「培训场次记录」里选一场，再看学员、归档和反馈。</p>;
  }
  if (tab === '参训学员') {
    return session ? (
      <TrainingProductAttendees plan={plan} session={session} />
    ) : (
      <p className="trn-prod-empty">正在读取这场培训的参训名单…</p>
    );
  }
  if (tab === '培训归档') {
    return session ? (
      <TrainingProductArchive plan={plan} session={session} />
    ) : (
      <p className="trn-prod-empty">正在读取这场培训的归档信息…</p>
    );
  }
  if (tab === '学员反馈') {
    return session ? (
      <TrainingProductFeedback plan={plan} session={session} />
    ) : (
      <p className="trn-prod-empty">正在读取这场培训的学员反馈…</p>
    );
  }
  return <p className="trn-prod-empty">没有这个页签。</p>;
}

function BasicInfoFields({
  plan,
  attendeeTotal,
  lecturers,
  onEdit,
}: {
  plan: TrainingPlan;
  attendeeTotal: number | null;
  lecturers: string;
  onEdit: () => void;
}) {
  const isOperator = useIsOperator();
  return (
    <div className="trn-prod-info" aria-label="培训计划基本信息">
      {isOperator ? (
        <div className="trn-prod-info-head">
          <h3 className="trn-prod-section-title">基本信息</h3>
          <Button size="small" icon={<Pencil size={13} />} onClick={onEdit}>
            编辑
          </Button>
        </div>
      ) : null}
      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">计划标识</h3>
        <dl className="trn-prod-kv">
          <InfoField label="培训计划编号" value={plan.planNo} />
          <InfoField
            label="培训计划状态"
            value={<span className="trn-prod-status">{plan.planState}</span>}
          />
          <InfoField label="培训计划名称" value={plan.planName} wide />
        </dl>
      </section>

      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">课程与人员</h3>
        <dl className="trn-prod-kv">
          <InfoField label="培训课程" value={plan.courseName ?? '—'} />
          <InfoField label="授课讲师" value={lecturers} />
          <InfoField label="运营负责人" value={plan.ownerName ?? plan.ownerNo} />
          <InfoField label="培训介绍" value={plan.targetScope || '—'} wide />
        </dl>
      </section>

      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">场次与人数</h3>
        <dl className="trn-prod-kv">
          <InfoField
            label="计划培训场次"
            value={plan.planSessionCount == null ? '—' : `${plan.planSessionCount} 场`}
          />
          <InfoField
            label="实际完成场次"
            value={`${plan.actualSessionCount} 场`}
            extra="由培训场次记录自动汇总"
          />
          <InfoField
            label="实际参训人数"
            value={attendeeTotal == null ? '—' : `${attendeeTotal} 人`}
            extra="由培训场次记录的签到人数自动汇总"
          />
        </dl>
      </section>

      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">时间与备注</h3>
        <dl className="trn-prod-kv">
          <InfoField
            label="计划培训时间"
            value={`${plan.planStartDate} ～ ${plan.planEndDate}`}
          />
          <InfoField label="实际培训时间" value={plan.actualFinishDate ?? '—'} />
          <InfoField label="备注" value={plan.remark ?? '—'} wide />
        </dl>
      </section>
    </div>
  );
}

function InfoField({
  label,
  value,
  extra,
  wide,
}: {
  label: string;
  value: ReactNode;
  extra?: string;
  wide?: boolean;
}) {
  return (
    <div className="trn-prod-field" data-span={wide ? '2' : undefined} data-testid="product-training-field">
      <dt>{label}</dt>
      <dd>
        {value}
        {extra ? <span className="trn-prod-field-extra">{extra}</span> : null}
      </dd>
    </div>
  );
}

function uniqueLecturers(rows: readonly TrainingSession[]): string {
  const names = [
    ...new Set(
      rows
        .map((row) => row.lecturerName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  return names.length > 0 ? names.join('、') : '—';
}
