import { useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Descriptions, Form, Input, Modal, Select, Space, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { DEMAND_OBJECT_TYPE, demandApi, type Demand, type DemandReview } from '@/shared/api/demands';
import { allowedAction, fieldOf, transitionApi } from '@/shared/api/transitions';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { neutral, space } from '@/shared/theme/designTokens';
import { DemandAttachments, DEMAND_REF_FIELDS } from './DemandAttachments';
import { DEMAND_STATE_FIELDS, FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './demandMeta';

const { Text } = Typography;

/**
 * 详情页「评审信息」页签（需求 8.3.2、5.2.1）。
 *
 * <p><b>录入结论必须同时选分流出口。</b>需求 5.2.1 的副作用列写着「必须同时填写分流出口」——
 * 它不是可以事后补的字段：出口决定后续激活哪一组状态字段，评审已结束却没有出口的需求，
 * 在列表的「当前处理状态」列上是一个永久的空白，也没有任何动作能推进它。因此这里只有一个
 * 「录入评审结论」入口，没有单独的「只改状态」按钮。
 *
 * <p><b>录入入口的显隐取自转换接口。</b>什么时候能录由后端的转换表说了算，前端不另写一套判断——
 * 那套判断就是需求第 5 章转换表的第二份拷贝。
 */

interface DemandReviewsTabProps {
  demand: Demand;
}

interface ConclusionValues {
  reviewDate: Dayjs;
  reviewConclusion?: string;
  reviewOpinion?: string;
  outlet: string;
}

/** 录入评审结论的动作码，与后端 {@code DemandStateMachines.ACTION_RECORD_REVIEW_RESULT} 一致。 */
const ACTION_RECORD_REVIEW_RESULT = 'RECORD_REVIEW_RESULT';

export function DemandReviewsTab({ demand }: DemandReviewsTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const [recording, setRecording] = useState(false);
  const [form] = Form.useForm<ConclusionValues>();

  const reviews = useQuery({
    queryKey: ['demands', demand.id, 'reviews'],
    queryFn: () => demandApi.reviews(demand.id),
  });

  const availability = useQuery({
    queryKey: ['demands', demand.id, 'available'],
    queryFn: () => transitionApi.available(DEMAND_OBJECT_TYPE, demand.id),
  });
  const canRecord =
    allowedAction(fieldOf(availability.data, DEMAND_STATE_FIELDS.review), ACTION_RECORD_REVIEW_RESULT) !== null;

  const record = useMutation({
    mutationFn: (values: ConclusionValues) =>
      demandApi.recordReviewConclusion(demand.id, {
        reviewDate: values.reviewDate.format('YYYY-MM-DD'),
        reviewConclusion: values.reviewConclusion ?? null,
        reviewOpinion: values.reviewOpinion ?? null,
        outlet: values.outlet,
        version: demand.version,
      }),
    onSuccess: () => {
      message.success('评审结论与分流出口已录入，需求评审状态已随之变更');
      setRecording(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="结论与分流出口必须一起录入"
        description="评审结束后要立刻决定这条需求走哪个出口，出口决定后面激活哪一组状态字段。重新评审会清空出口，届时需要重新录一次结论。"
      />

      <Card
        size="small"
        title="当前评审信息"
        extra={
          isOperator &&
          canRecord && (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({ reviewDate: dayjs() });
                setRecording(true);
              }}
            >
              录入评审结论
            </Button>
          )
        }
      >
        <Descriptions
          column={2}
          size="small"
          styles={{ label: { color: neutral[600], width: 120 } }}
          items={[
            { key: 'state', label: '需求评审状态', children: demand.reviewState },
            { key: 'date', label: '评审日期', children: demand.reviewDate ?? '—' },
            { key: 'outlet', label: '分流出口', children: demand.outlet ?? '—' },
            { key: 'round', label: '评审轮次', children: reviews.data ? `${reviews.data.length} 轮` : '—' },
            { key: 'conclusion', label: '评审结论', span: 2, children: demand.reviewConclusion ?? '—' },
            { key: 'opinion', label: '评审专业意见', span: 2, children: demand.reviewOpinion ?? '—' },
            {
              key: 'minutes',
              label: '评审会议纪要',
              span: 2,
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
      </Card>

      <Table<DemandReview>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={reviews.data ?? []}
        loading={reviews.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有评审记录。录入评审结论后自动生成第 1 轮' }}
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'conclusion', label: '评审结论', children: row.reviewConclusion ?? '—' },
                { key: 'opinion', label: '评审专业意见', children: row.reviewOpinion ?? '—' },
              ]}
            />
          ),
        }}
        columns={[
          { title: '轮次', dataIndex: 'roundNo', width: 80, render: (round: number) => `第 ${round} 轮` },
          { title: '评审日期', dataIndex: 'reviewDate', width: 120, render: (v: string | null) => v ?? '—' },
          {
            title: '评审结论',
            dataIndex: 'reviewConclusion',
            ellipsis: true,
            render: (v: string | null) => v ?? '—',
          },
          { title: '录入时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
          { title: '录入账号', dataIndex: 'createdBy', width: 100 },
        ]}
      />

      <Modal
        open={recording}
        title="录入评审结论"
        okText="保存结论"
        cancelText="取消"
        width={680}
        confirmLoading={record.isPending}
        onCancel={() => setRecording(false)}
        onOk={() => void form.validateFields().then((values) => record.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">
            保存后需求评审状态随之变更，并生成一轮评审记录。历史轮次只读——录错要走「重新评审」再录一次，
            不是改这一轮。
          </Text>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              label="评审日期"
              name="reviewDate"
              extra="线下会议的实际日期，可回填"
              rules={[{ required: true, message: '请选择评审日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="分流出口"
              name="outlet"
              extra="出口决定后续激活哪一组字段：出口一填解决方案，出口二走开发流程。线下评审认为可以直接复用已有工具时仍走出口一，把「复用哪个工具、怎么用」写成解决方案"
              rules={[{ required: true, message: '请选择分流出口' }]}
            >
              <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandOutlet])} />
            </Form.Item>
            <Form.Item label="评审结论" name="reviewConclusion">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
            <Form.Item label="评审专业意见" name="reviewOpinion">
              <Input.TextArea rows={4} maxLength={2000} showCount />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
}
