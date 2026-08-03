import { useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Descriptions, Form, Input, Modal, Select, Space, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { DEMAND_OBJECT_TYPE, demandApi, type Demand, type DemandAcceptance } from '@/shared/api/demands';
import { allowedAction, fieldOf, transitionApi } from '@/shared/api/transitions';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { neutral, space } from '@/shared/theme/designTokens';
import { DEMAND_STATE_FIELDS, FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './demandMeta';

const { Text } = Typography;

/**
 * 详情页「业务验收」页签（需求 8.2 V1.2 新增、8.3.4、5.2.5）。
 *
 * <p><b>「标记交付使用」走专用接口而不是统一转换接口。</b>它一次驱动两个状态机（需求交付标记与
 * 业务验收状态，5.2.5 的两张表都由这一次点击驱动），统一转换接口一次只推一个状态字段，
 * 走那条路只会推动其中一个，留下一条「已标记交付但没进入验收流程」的需求。
 *
 * <p><b>验收可以反复。</b>不通过后重新提交会让轮次 +1，历史每一轮都留档——「这条需求验了几次才过」
 * 是业务方最常回看的一件事，把结论直接覆盖在主表上就看不出来了。
 *
 * <p><b>验收人是自由文本，不关联人员表</b>（5.2.5 落地要点第 2 条）：业务接口人可能不在人员台账里。
 */

interface DemandAcceptanceTabProps {
  demand: Demand;
}

interface ConclusionValues {
  acceptorName: string;
  acceptedAt: Dayjs;
  acceptanceResult: string;
  acceptanceOpinion?: string;
}

/** 动作码，与后端 {@code DemandStateMachines.ACTION_*} 一致。 */
const ACTION_MARK_DELIVERED = 'MARK_DELIVERED';
const ACTION_RECORD_ACCEPTANCE_PASS = 'RECORD_ACCEPTANCE_PASS';
const ACTION_RECORD_ACCEPTANCE_REJECT = 'RECORD_ACCEPTANCE_REJECT';

export function DemandAcceptanceTab({ demand }: DemandAcceptanceTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const [recording, setRecording] = useState(false);
  const [form] = Form.useForm<ConclusionValues>();

  const records = useQuery({
    queryKey: ['demands', demand.id, 'acceptances'],
    queryFn: () => demandApi.acceptances(demand.id),
  });

  const availability = useQuery({
    queryKey: ['demands', demand.id, 'available'],
    queryFn: () => transitionApi.available(DEMAND_OBJECT_TYPE, demand.id),
  });
  const deliveryField = fieldOf(availability.data, DEMAND_STATE_FIELDS.deliveryMark);
  const acceptanceField = fieldOf(availability.data, DEMAND_STATE_FIELDS.acceptance);
  const canDeliver = allowedAction(deliveryField, ACTION_MARK_DELIVERED) !== null;
  const canRecord =
    allowedAction(acceptanceField, ACTION_RECORD_ACCEPTANCE_PASS) !== null ||
    allowedAction(acceptanceField, ACTION_RECORD_ACCEPTANCE_REJECT) !== null;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['demands'] });

  const deliver = useMutation({
    mutationFn: () => demandApi.markDelivered(demand.id, demand.version),
    onSuccess: () => {
      message.success('已标记交付使用，需求同时进入业务验收流程');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '标记失败，请重试'),
  });

  const record = useMutation({
    mutationFn: (values: ConclusionValues) =>
      demandApi.recordAcceptanceConclusion(demand.id, {
        acceptorName: values.acceptorName,
        acceptedAt: values.acceptedAt.format('YYYY-MM-DD'),
        acceptanceResult: values.acceptanceResult,
        acceptanceOpinion: values.acceptanceOpinion ?? null,
        version: demand.version,
      }),
    onSuccess: () => {
      message.success('验收结论已录入，业务验收状态已随之变更');
      setRecording(false);
      form.resetFields();
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="验收发生在线下，平台只记录结论"
        description="结论只有通过与不通过加一段意见，不做价值量化。归档要求业务验收已通过，未通过时点归档会被拒绝并说明原因。"
      />

      <Card
        size="small"
        title="交付与验收"
        extra={
          isOperator && (
            <Space size={space.xs}>
              {canDeliver && (
                <Button size="small" loading={deliver.isPending} onClick={() => deliver.mutate()}>
                  标记交付使用
                </Button>
              )}
              {canRecord && (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    form.resetFields();
                    form.setFieldsValue({ acceptedAt: dayjs() });
                    setRecording(true);
                  }}
                >
                  录入验收结论
                </Button>
              )}
            </Space>
          )
        }
      >
        <Descriptions
          column={2}
          size="small"
          styles={{ label: { color: neutral[600], width: 120 } }}
          items={[
            { key: 'mark', label: '交付使用标记', children: demand.deliveryMark ?? '—' },
            { key: 'deliveredAt', label: '交付时间', children: demand.deliveredAt ?? '—' },
            { key: 'state', label: '业务验收状态', children: demand.acceptanceState ?? '—' },
            {
              key: 'round',
              label: '验收轮次',
              children: demand.acceptanceRound ? `第 ${demand.acceptanceRound} 轮` : '—',
            },
            { key: 'acceptor', label: '验收人', children: demand.acceptorName ?? '—' },
            { key: 'acceptedAt', label: '验收时间', children: demand.acceptedAt ?? '—' },
            { key: 'archivedAt', label: '归档时间', children: demand.archivedAt ?? '—' },
            { key: 'opinion', label: '验收意见', span: 2, children: demand.acceptanceOpinion ?? '—' },
          ]}
        />
      </Card>

      <Table<DemandAcceptance>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={records.data ?? []}
        loading={records.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有验收记录。标记交付使用后即可录入第 1 轮结论' }}
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions
              size="small"
              column={1}
              items={[{ key: 'opinion', label: '验收意见', children: row.acceptanceOpinion ?? '—' }]}
            />
          ),
        }}
        columns={[
          { title: '轮次', dataIndex: 'roundNo', width: 80, render: (round: number) => `第 ${round} 轮` },
          { title: '验收人', dataIndex: 'acceptorName', width: 120 },
          { title: '验收时间', dataIndex: 'acceptedAt', width: 120 },
          { title: '验收结论', dataIndex: 'acceptanceResult', width: 110 },
          { title: '录入时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
          { title: '录入账号', dataIndex: 'createdBy', width: 100 },
        ]}
      />

      <Modal
        open={recording}
        title="录入验收结论"
        okText="保存结论"
        cancelText="取消"
        width={640}
        confirmLoading={record.isPending}
        onCancel={() => setRecording(false)}
        onOk={() => void form.validateFields().then((values) => record.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">
            结论决定业务验收状态推到哪一个取值。保存后本轮记录只读，要改结论只能重新提交验收再录一轮。
          </Text>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              label="验收人"
              name="acceptorName"
              extra="自由填写，不与人员台账关联——业务接口人可能不在人员表里"
              rules={[{ required: true, message: '请填写验收人' }]}
            >
              <Input maxLength={50} showCount />
            </Form.Item>
            <Form.Item
              label="验收时间"
              name="acceptedAt"
              extra="线下验收的实际日期，可回填"
              rules={[{ required: true, message: '请选择验收时间' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="验收结论"
              name="acceptanceResult"
              rules={[{ required: true, message: '请选择验收结论' }]}
            >
              <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandAcceptanceResult])} />
            </Form.Item>
            <Form.Item label="验收意见" name="acceptanceOpinion" extra="结论为不通过时建议写清原因">
              <Input.TextArea rows={4} maxLength={1000} showCount />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
}
