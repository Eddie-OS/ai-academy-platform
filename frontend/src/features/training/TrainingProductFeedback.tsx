import { useState } from 'react';
import { Button, Space, Table } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import {
  trainingApi,
  type TrainingFeedbackItem,
  type TrainingPlan,
  type TrainingSession,
} from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { FeedbackRemarkModal } from './SessionFeedbackTab';

/**
 * 产品详情「学员反馈」：按规格 8 个字段展示。
 *
 * <p>反馈唯一入口仍是导入中心（FB2／N20），弹窗不提供学员提交。正文任何账号都不可改（FB1）。
 * 规格稿的「课后问卷／现场访谈／线上留言／专项调研」和反馈附件一期没有：来源展示导入写入的
 * 反馈场景，附件一律「—」。评分是整数 1–5，不是两位小数。
 */

const PAGE_SIZE = 20;

interface TrainingProductFeedbackProps {
  plan: TrainingPlan;
  session: TrainingSession;
}

export function TrainingProductFeedback({ plan, session }: TrainingProductFeedbackProps) {
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pageNum, setPageNum] = useState(1);
  const [remarking, setRemarking] = useState<TrainingFeedbackItem | null>(null);

  const summary = useQuery({
    queryKey: ['training-sessions', session.id, 'feedback-summary'],
    queryFn: () => trainingApi.feedbackSummary(session.id),
  });
  const page = useQuery({
    queryKey: ['training-sessions', session.id, 'feedbacks', pageNum],
    queryFn: () => trainingApi.feedbacks(session.id, pageNum, PAGE_SIZE),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-sessions', session.id, 'feedbacks'] });
    void queryClient.invalidateQueries({
      queryKey: ['training-sessions', session.id, 'feedback-summary'],
    });
  };

  const stats = summary.data;
  const sessionLabel = session.sessionName?.trim() || session.sessionNo;

  return (
    <div className="trn-prod-feedback">
      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">关联信息</h3>
        <dl className="trn-prod-kv">
          <div className="trn-prod-field" data-testid="product-feedback-field">
            <dt>关联培训计划</dt>
            <dd>{plan.planName}</dd>
          </div>
          <div className="trn-prod-field" data-testid="product-feedback-field">
            <dt>关联培训场次</dt>
            <dd>
              {sessionLabel}
              <span className="trn-prod-field-extra">选定后不可改；要换场请到「培训场次记录」</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">本场汇总</h3>
        <div className="trn-prod-metrics">
          <div className="trn-prod-metric" data-testid="product-feedback-field">
            <p className="trn-prod-metric-label">反馈条数</p>
            <p className="trn-prod-metric-value">{stats?.total ?? 0}</p>
            <p className="trn-prod-metric-extra">再次导入将追加，不会覆盖</p>
          </div>
          <div className="trn-prod-metric" data-testid="product-feedback-field">
            <p className="trn-prod-metric-label">综合满意度均分</p>
            <p className="trn-prod-metric-value">
              {stats?.averageScore ? `${stats.averageScore} / 5` : EM_DASH}
            </p>
            <p className="trn-prod-metric-extra">单条是整数 1–5，均分保留 1 位小数</p>
          </div>
          <div className="trn-prod-metric" data-testid="product-feedback-field">
            <p className="trn-prod-metric-label">匿名条数</p>
            <p className="trn-prod-metric-value">{stats?.anonymousCount ?? 0}</p>
            <p className="trn-prod-metric-extra">匿名同样计入均分</p>
          </div>
        </div>
      </section>

      <section className="trn-prod-section">
        <div className="trn-prod-attendees-head">
          <h3 className="trn-prod-section-title">反馈记录</h3>
          {isOperator && (
            <Link to="/imports">
              <Button type="primary" icon={<Upload size={14} />}>
                去导入中心上传 Excel
              </Button>
            </Link>
          )}
        </div>
        <p className="trn-prod-attendees-hint">
          用导入中心的「学员反馈」模板上传。反馈来源展示导入写入的场景，不另开来源下拉；不接收问卷附件，也不在这里改原文。
        </p>

        <Table<TrainingFeedbackItem>
          size="small"
          rowKey={(row) => String(row.id)}
          dataSource={page.data?.records ?? []}
          loading={page.isLoading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: '还没有学员反馈。到导入中心用「学员反馈」模板上传。' }}
          pagination={{
            current: pageNum,
            pageSize: PAGE_SIZE,
            total: page.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPageNum,
            showTotal: (count) => `共 ${count} 条`,
          }}
          columns={[
            {
              title: '提交人',
              key: 'submitter',
              width: 120,
              render: (_, row) =>
                row.submitterNo == null ? '匿名' : (row.submitterName ?? row.submitterNo),
            },
            {
              title: '反馈来源',
              dataIndex: 'feedbackScene',
              width: 110,
              render: (value: string | null) => value || EM_DASH,
            },
            {
              title: '反馈提交时间',
              dataIndex: 'importedAt',
              width: 150,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: '综合满意度',
              dataIndex: 'score',
              width: 110,
              align: 'right',
              render: (score: number) => (
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score} / 5</span>
              ),
            },
            {
              title: '优化建议 / 问题反馈',
              dataIndex: 'content',
              render: (value: string | null) => value || EM_DASH,
            },
            {
              title: '反馈附件',
              key: 'attachment',
              width: 88,
              render: () => EM_DASH,
            },
            {
              title: '备注',
              key: 'opsRemark',
              width: 180,
              render: (_, row) => (
                <Space direction="vertical" size={0}>
                  <span>{row.opsRemark || EM_DASH}</span>
                  {row.remarkedAt ? (
                    <span className="trn-prod-field-extra">{formatDateTime(row.remarkedAt)}</span>
                  ) : null}
                </Space>
              ),
            },
            ...(isOperator
              ? [
                  {
                    title: '操作',
                    key: 'actions',
                    width: 88,
                    align: 'right' as const,
                    render: (_: unknown, row: TrainingFeedbackItem) => (
                      <Button type="link" size="small" onClick={() => setRemarking(row)}>
                        写备注
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>

      {remarking && (
        <FeedbackRemarkModal
          sessionId={session.id}
          item={remarking}
          onClose={() => setRemarking(null)}
          onSaved={() => {
            setRemarking(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
