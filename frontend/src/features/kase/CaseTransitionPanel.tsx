import { useState } from 'react';
import { App, Card, Form, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import type { CaseInfo } from '@/shared/api/cases';
import { transitionApi, type ActionOption } from '@/shared/api/transitions';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { useIsOperator } from '@/shared/store/authStore';
import { neutral, space } from '@/shared/theme/designTokens';
import { CASE_STATE_FIELD } from './caseMeta';

const { Text } = Typography;

/**
 * 案例详情的状态区（需求 5.9）。
 *
 * <p>案例只有一个状态字段，因此这里比需求与课程的状态区短得多。按钮同样完全由后端的
 * available 接口决定，前端不做任何本地状态推断。
 *
 * <p><b>两个审核动作在这里只显示、不执行。</b>点一下就推状态，会留下一条没有审核人的
 * 已上架案例——C9 把「上架前必须审核通过」列为三处硬阻断之一，而一条查不到是谁批的
 * 已上架案例，恰恰是那条硬阻断想防的东西。它们引导到「录入审核结论」。
 */

/** 路径段。统一转换接口的第一段用的是复数资源名，与 {@code /api/cases} 一致。 */
const CASE_PATH = 'cases';

interface CaseTransitionPanelProps {
  caseInfo: CaseInfo;
  onRequestAudit: () => void;
}

export function CaseTransitionPanel({ caseInfo, onRequestAudit }: CaseTransitionPanelProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pending, setPending] = useState<ActionOption | null>(null);
  const [remarkForm] = Form.useForm<{ remark?: string }>();

  const availability = useQuery({
    queryKey: ['cases', caseInfo.id, 'available'],
    queryFn: () => transitionApi.available(CASE_PATH, caseInfo.id),
  });

  const transit = useMutation({
    mutationFn: (values: { remark?: string }) => {
      if (!pending) {
        throw new Error('没有选中任何动作');
      }
      return transitionApi.transit(CASE_PATH, caseInfo.id, {
        stateField: CASE_STATE_FIELD,
        action: pending.action,
        version: caseInfo.version,
        remark: values.remark ?? null,
      });
    },
    onSuccess: (result) => {
      message.success(`案例状态已变更为「${result.toState}」`);
      setPending(null);
      remarkForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  const field = availability.data?.fields.find((item) => item.stateField === CASE_STATE_FIELD);
  const options = field?.actions ?? [];
  const plain = options.filter((option) => !AUDIT_ACTIONS.has(option.action));
  const audit = options.filter(
    (option) => AUDIT_ACTIONS.has(option.action) && field?.allowedActions.includes(option.label),
  );

  return (
    <>
      <Card size="small" title="状态与可执行动作">
        <div style={{ display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
          <Text style={{ color: neutral[600] }}>{CASE_STATE_FIELD}</Text>
          <Tag color={field?.terminal ? 'default' : 'blue'}>{field?.currentState ?? '（空）'}</Tag>
          {isOperator && (
            <>
              <ActionGuard
                availability={
                  field && {
                    allowedActions: field.allowedActions,
                    blockedActions: field.blockedActions,
                  }
                }
                actions={plain.map((option) => ({
                  action: option.label,
                  onClick: () => setPending(option),
                }))}
              />
              {audit.length > 0 && (
                <Tooltip title="审核结论与状态必须一起保存。在这里只改状态，会留下一条对外可见却查不到是谁批的案例">
                  <Tag
                    data-testid="delegated-action"
                    color="warning"
                    style={{ cursor: 'pointer' }}
                    onClick={onRequestAudit}
                  >
                    录入审核结论 · 点此填写四个字段
                  </Tag>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </Card>

      <Modal
        open={pending !== null}
        title={pending ? `${CASE_STATE_FIELD}：${pending.label}` : ''}
        okText="确认变更"
        cancelText="取消"
        confirmLoading={transit.isPending}
        onCancel={() => setPending(null)}
        onOk={() => void remarkForm.validateFields().then((values) => transit.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">
            变更后状态为「{pending?.toState}」。状态变更会写入流转日志，不可撤销——
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
 * 这两个动作不在状态区直接执行，引导到审核弹窗。
 *
 * <p>动作码而不是中文名：动作码是后端转换表里的稳定标识，中文名会随文案调整变。
 */
const AUDIT_ACTIONS = new Set(['AUDIT_PASS', 'AUDIT_REJECT']);
