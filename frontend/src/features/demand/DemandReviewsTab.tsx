import { useEffect } from 'react';
import { Alert, App, Button, Descriptions, Form, Input, Select, Space, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { demandApi, type Demand, type DemandReview } from '@/shared/api/demands';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { invalidateDemandGraph } from '@/shared/query/invalidateGraph';
import { space } from '@/shared/theme/designTokens';
import { DemandAttachments, DEMAND_REF_FIELDS } from './DemandAttachments';
import {
  DEMAND_OBJECT_TYPE_CODE,
  DEMAND_STATE_FIELDS,
  FIELD_ENUM_KEYS,
  reviewConclusionValue,
  selectOptions,
  useFieldEnums,
  useOutlets,
  useStates,
} from './demandMeta';

const { Text } = Typography;

/**
 * 详情页「评审信息」页签。
 *
 * <p>评审状态与结论都是可搜索下拉，取值来自元数据（纪律 STK-1）。结论三值映射分流出口，
 * 状态变更走后端编排接口，不在前端连跳、也不手写状态值。
 */

interface DemandReviewsTabProps {
  demand: Demand;
  /** 演示行：展示同一套字段，保存前提示先新建 */
  demo?: boolean;
}

interface ReviewInfoValues {
  reviewState: string;
  reviewConclusion: string;
  priority?: string;
  reviewOpinion: string;
  reviewRemark?: string;
}

export function DemandReviewsTab({ demand, demo }: DemandReviewsTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const outlets = useOutlets();
  const reviewStates = useStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.review);
  const conclusions = fieldEnums.data?.[FIELD_ENUM_KEYS.demandReviewConclusion];
  const [form] = Form.useForm<ReviewInfoValues>();
  const canEdit = isOperator && !demo;

  const reviews = useQuery({
    queryKey: ['demands', demand.id, 'reviews'],
    queryFn: () => demandApi.reviews(demand.id),
    enabled: !demo,
  });

  useEffect(() => {
    form.setFieldsValue({
      reviewState: demand.reviewState,
      reviewConclusion: reviewConclusionValue(
        demand.reviewConclusion,
        demand.outlet,
        conclusions,
        outlets,
      ),
      priority: demand.priority ?? undefined,
      reviewOpinion: demand.reviewOpinion ?? undefined,
      reviewRemark: demand.reviewRemark ?? undefined,
    });
  }, [
    form,
    demand.id,
    demand.version,
    demand.reviewState,
    demand.reviewConclusion,
    demand.outlet,
    demand.priority,
    demand.reviewOpinion,
    demand.reviewRemark,
    conclusions,
    outlets.solution,
    outlets.development,
    outlets.reject,
  ]);

  const save = useMutation({
    mutationFn: (values: ReviewInfoValues) =>
      demandApi.saveReviewInfo(demand.id, {
        reviewState: values.reviewState,
        reviewConclusion: values.reviewConclusion,
        reviewOpinion: values.reviewOpinion,
        reviewRemark: values.reviewRemark || null,
        priority: values.priority || null,
        version: demand.version,
      }),
    onSuccess: () => {
      message.success('评审信息已保存');
      invalidateDemandGraph(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  return (
    <Space className="dmd-review-form" direction="vertical" size={space.md} style={{ width: '100%' }}>
      {demo && (
        <Alert
          type="info"
          showIcon
          message="演示数据不能保存评审信息"
          description="请先「新建需求」或打开已落库的需求，再在此页填写。"
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark
        disabled={!canEdit}
        onFinish={(values) => {
          if (demo) {
            message.info('演示数据无法保存，请先「新建需求」');
            return;
          }
          void save.mutateAsync(values);
        }}
      >
        <Form.Item
          label="评审状态"
          name="reviewState"
          rules={[{ required: true, message: '请选择评审状态' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={selectOptions(reviewStates)}
            placeholder="请选择评审状态"
          />
        </Form.Item>
        <Form.Item
          label="评审结论"
          name="reviewConclusion"
          rules={[{ required: true, message: '请选择评审结论' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={selectOptions(conclusions)}
            placeholder="请选择评审结论"
          />
        </Form.Item>
        <Form.Item label="开发优先级" name="priority">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandPriority])}
            placeholder="请选择开发优先级"
          />
        </Form.Item>
        <Form.Item
          label="评审意见"
          name="reviewOpinion"
          extra="专家评审意见、不通过原因等"
          rules={[{ required: true, message: '请填写评审意见' }]}
        >
          <Input.TextArea rows={5} autoSize={{ minRows: 4 }} />
        </Form.Item>
        <Form.Item label="备注" name="reviewRemark">
          <Input.TextArea rows={3} autoSize={{ minRows: 2 }} />
        </Form.Item>
        {canEdit && (
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              保存
            </Button>
          </Form.Item>
        )}
      </Form>

      {!demo && (
        <>
          <Descriptions
            size="small"
            column={1}
            items={[
              {
                key: 'minutes',
                label: '评审会议纪要',
                children: (
                  <DemandAttachments
                    demandId={demand.id}
                    refField={DEMAND_REF_FIELDS.reviewMinutes}
                    emptyHint="还没有上传会议纪要"
                  />
                ),
              },
            ]}
          />

          <Text type="secondary">历史轮次只读。录错请走重新评审再保存一轮，不要改旧记录。</Text>
          <Table<DemandReview>
            size="small"
            rowKey={(row) => String(row.id)}
            dataSource={reviews.data ?? []}
            loading={reviews.isLoading}
            pagination={false}
            locale={{ emptyText: '还没有评审记录。本轮评审结束后自动生成第 1 轮' }}
            expandable={{
              expandedRowRender: (row) => (
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    { key: 'conclusion', label: '评审结论', children: row.reviewConclusion ?? '—' },
                    { key: 'opinion', label: '评审意见', children: row.reviewOpinion ?? '—' },
                    { key: 'remark', label: '备注', children: row.remark ?? '—' },
                  ]}
                />
              ),
            }}
            columns={[
              { title: '轮次', dataIndex: 'roundNo', width: 72, render: (round: number) => `第 ${round} 轮` },
              { title: '评审日期', dataIndex: 'reviewDate', width: 110, render: (v: string | null) => v ?? '—' },
              {
                title: '评审结论',
                dataIndex: 'reviewConclusion',
                ellipsis: true,
                render: (v: string | null) => v ?? '—',
              },
              { title: '录入时间', dataIndex: 'createdAt', width: 150, render: formatDateTime },
            ]}
          />
        </>
      )}
    </Space>
  );
}
