import { useState } from 'react';
import { App, Card, Form, Input, Modal, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { transitionApi, type ActionOption } from '@/shared/api/transitions';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { useIsOperator } from '@/shared/store/authStore';
import { neutral, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 培训计划与培训场次的状态区（需求 5.7、5.8）。
 *
 * <p>两类对象共用一个组件：它们都只有一个状态字段、都没有版本号、转换都不需要同时录入
 * 业务字段。课程那边之所以自己一份，是因为「关闭课程开发」必须带上关闭原因。
 *
 * <p><b>按钮完全由后端的 available 接口决定。</b>前端不做任何本地状态推断——可执行的能点，
 * 不可执行的置灰并挂上后端给的状态原因，两个列表都没提到的根本不渲染。
 *
 * <p><b>计划状态不会自动跟着场次走</b>（规则 C1）：全部场次结束后，计划仍停在「执行中」，
 * 直到运营在这里点一下。这是刻意的——平台记录线下已经发生的事，不替线下做判断。
 */

interface TrainingTransitionPanelProps {
  /** 对象类型的路径段：{@code training-plans} 或 {@code training-sessions} */
  objectType: string;
  objectId: number;
  /** 变更成功后要失效的查询键前缀 */
  invalidateKey: string;
}

export function TrainingTransitionPanel({
  objectType,
  objectId,
  invalidateKey,
}: TrainingTransitionPanelProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pending, setPending] = useState<{ field: string; option: ActionOption } | null>(null);
  const [remarkForm] = Form.useForm<{ remark?: string }>();

  const availability = useQuery({
    queryKey: [objectType, objectId, 'available'],
    queryFn: () => transitionApi.available(objectType, objectId),
  });

  const transit = useMutation({
    mutationFn: (values: { remark?: string }) => {
      if (!pending) {
        throw new Error('没有选中任何动作');
      }
      return transitionApi.transit(objectType, objectId, {
        stateField: pending.field,
        action: pending.option.action,
        remark: values.remark ?? null,
      });
    },
    onSuccess: (result) => {
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setPending(null);
      remarkForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      void queryClient.invalidateQueries({ queryKey: [objectType, objectId] });
      void availability.refetch();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  return (
    <>
      <Card size="small" title="状态与可执行动作">
        <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
          {(availability.data?.fields ?? []).map((field) => (
            <div
              key={field.stateField}
              style={{ display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}
            >
              <Text style={{ width: 110, color: neutral[600] }}>{field.stateField}</Text>
              <Tag color={field.terminal ? 'default' : 'blue'}>{field.currentState ?? '（空）'}</Tag>
              {isOperator && (
                <ActionGuard
                  availability={{
                    allowedActions: field.allowedActions,
                    blockedActions: field.blockedActions,
                  }}
                  actions={field.actions.map((option) => ({
                    action: option.label,
                    onClick: () => setPending({ field: field.stateField, option }),
                  }))}
                />
              )}
            </div>
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
        onOk={() =>
          void remarkForm
            .validateFields()
            .then((values) => transit.mutateAsync(values))
            .catch(() => undefined)
        }
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
