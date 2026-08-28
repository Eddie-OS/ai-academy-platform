import { useState } from 'react';
import { App, Card, Form, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { DEMAND_OBJECT_TYPE, type Demand } from '@/shared/api/demands';
import { transitionApi, type ActionOption, type FieldAvailability } from '@/shared/api/transitions';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { invalidateDemandGraph } from '@/shared/query/invalidateGraph';
import { useIsOperator } from '@/shared/store/authStore';
import { neutral, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 需求详情页的状态区：五个状态字段各自的当前状态与可执行动作（需求 5.2）。
 *
 * <p><b>按钮完全由后端的 available 接口决定。</b>前端不做任何本地状态推断——ActionGuard 是状态门
 * 不是权限门：可执行的能点，不可执行的置灰并挂上后端给的状态原因，两个列表都没提到的
 * 根本不渲染。渲染一个后端没说可用的按钮，等于让运营点了之后拿到 ILLEGAL_TRANSITION。
 *
 * <p>出口一与出口二各有一组状态字段，当前出口用不到的那一组后端仍会下发（当前状态为空、
 * 无可执行动作）。<b>这一行照常显示</b>：空着的那组恰恰说明「这条需求走的不是这个出口」，
 * 藏起来会让人以为平台漏了字段。
 */

interface DemandTransitionPanelProps {
  demand: Demand;
}

export function DemandTransitionPanel({ demand }: DemandTransitionPanelProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pending, setPending] = useState<{ field: string; option: ActionOption } | null>(null);
  const [remarkForm] = Form.useForm<{ remark?: string }>();

  const availability = useQuery({
    queryKey: ['demands', demand.id, 'available'],
    queryFn: () => transitionApi.available(DEMAND_OBJECT_TYPE, demand.id),
  });

  const transit = useMutation({
    mutationFn: (values: { remark?: string }) => {
      if (!pending) {
        throw new Error('没有选中任何动作');
      }
      return transitionApi.transit(DEMAND_OBJECT_TYPE, demand.id, {
        stateField: pending.field,
        action: pending.option.action,
        version: demand.version,
        remark: values.remark ?? null,
      });
    },
    onSuccess: (result) => {
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setPending(null);
      remarkForm.resetFields();
      invalidateDemandGraph(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  const fields = availability.data?.fields ?? [];

  return (
    <>
      <Card size="small" title="状态与可执行动作">
        <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
          {fields.map((field) => (
            <FieldRow
              key={field.stateField}
              field={field}
              showActions={isOperator}
              onPick={(option) => setPending({ field: field.stateField, option })}
            />
          ))}
        </Space>
      </Card>

      <Modal
        open={pending !== null}
        title={pending ? `${pending.field}：${pending.option.label}` : ''}
        okText="确认变更"
        cancelText="取消"
        confirmLoading={transit.isPending}
        onCancel={() => setPending(null)}
        onOk={() => void remarkForm.validateFields().then((values) => transit.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">
            变更后状态为「{pending?.option.toState}」。状态变更会写入流转日志，不可撤销——
            要回退只能再走一次反向转换（如果转换表里有）。
          </Text>
          <Form form={remarkForm} layout="vertical" requiredMark={false}>
            <Form.Item
              label="变更说明"
              name="remark"
              extra="两个账号是共享的，日志记不到具体是谁。需要留痕时请在这里写上自己的姓名与依据"
            >
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  );
}

/**
 * 这些动作<b>不允许在状态区直接执行</b>，它们的状态变更是录入业务字段时的一部分。
 *
 * <p>在这里点一下「录入评审结论」，评审状态会推进，而分流出口是空的——需求 5.2.1 要求两者
 * 必须同时录入，出口为空的需求此后没有任何动作能推进它。因此按钮照常显示（运营需要知道
 * 下一步是什么），但点击引导到对应页签。
 *
 * <p>「标记交付使用」也在这里，理由不同：它<b>一次驱动两个状态机</b>（需求交付标记与业务验收
 * 状态，见需求 5.2.5 的两张表），而统一转换接口一次只推一个状态字段。走这里只会推动其中一个，
 * 留下一条「已标记交付但没进入验收流程」的需求。
 */
export const DELEGATED_ACTIONS: Record<string, string> = {
  RECORD_REVIEW_RESULT: '评审信息',
  CREATE_SOLUTION: '分流与处理',
  MARK_DELIVERED: '业务验收',
  RECORD_ACCEPTANCE_PASS: '业务验收',
  RECORD_ACCEPTANCE_REJECT: '业务验收',
};

interface FieldRowProps {
  field: FieldAvailability;
  showActions: boolean;
  onPick: (option: ActionOption) => void;
}

function FieldRow({ field, showActions, onPick }: FieldRowProps) {
  const plainOptions = field.actions.filter((option) => !DELEGATED_ACTIONS[option.action]);
  const delegated = field.actions.filter(
    (option) => DELEGATED_ACTIONS[option.action] && field.allowedActions.includes(option.label),
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
      <Text style={{ width: 112, color: neutral[600] }}>{field.stateField}</Text>
      <Tag color={field.terminal ? 'default' : 'blue'}>{field.currentState ?? '（空）'}</Tag>
      {showActions && (
        <>
          <ActionGuard
            availability={{ allowedActions: field.allowedActions, blockedActions: field.blockedActions }}
            actions={plainOptions.map((option) => ({
              action: option.label,
              onClick: () => onPick(option),
            }))}
          />
          {delegated.map((option) => (
            <Tooltip
              key={option.action}
              title={`这一步要与业务字段一起保存，请到「${DELEGATED_ACTIONS[option.action]}」页签录入。在这里只改状态会留下一条不完整的记录`}
            >
              <Tag data-testid="delegated-action" data-action={option.action} color="warning">
                {option.label} · 在「{DELEGATED_ACTIONS[option.action]}」页签录入
              </Tag>
            </Tooltip>
          ))}
        </>
      )}
    </div>
  );
}
