import { useState } from 'react';
import { App, Card, Descriptions, Form, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { COURSE_OBJECT_TYPE, courseApi, type Course } from '@/shared/api/courses';
import { transitionApi, type ActionOption, type FieldAvailability } from '@/shared/api/transitions';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { useIsOperator } from '@/shared/store/authStore';
import { neutral, space } from '@/shared/theme/designTokens';
import { COURSE_STATE_FIELDS } from './courseMeta';

const { Text } = Typography;

/**
 * 课程详情页的状态区：五个状态字段各自的当前状态与可执行动作（需求 5.3、5.4）。
 *
 * <p><b>按钮完全由后端的 available 接口决定。</b>前端不做任何本地状态推断——ActionGuard 是状态门
 * 不是权限门：可执行的能点，不可执行的置灰并挂上后端给的状态原因，两个列表都没提到的
 * 根本不渲染。渲染一个后端没说可用的按钮，等于让运营点了之后拿到 ILLEGAL_TRANSITION。
 *
 * <p><b>「关闭课程开发」不走这里。</b>它要同时录入必填的关闭原因（需求 9.3.2 第 20 项），
 * 走 {@code POST /api/courses/{id}/close}——状态与原因必须一起成功，拆成两步就会留下
 * 「已关闭但没有原因」的记录。
 */

interface CourseTransitionPanelProps {
  course: Course;
}

export function CourseTransitionPanel({ course }: CourseTransitionPanelProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pending, setPending] = useState<{ field: string; option: ActionOption } | null>(null);
  const [closing, setClosing] = useState(false);
  const [remarkForm] = Form.useForm<{ remark?: string }>();
  const [closeForm] = Form.useForm<{ closeReason: string }>();

  const availability = useQuery({
    queryKey: ['courses', course.id, 'available'],
    queryFn: () => transitionApi.available(COURSE_OBJECT_TYPE, course.id),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const transit = useMutation({
    mutationFn: (values: { remark?: string }) => {
      if (!pending) {
        throw new Error('没有选中任何动作');
      }
      return transitionApi.transit(COURSE_OBJECT_TYPE, course.id, {
        stateField: pending.field,
        action: pending.option.action,
        version: course.version,
        remark: values.remark ?? null,
      });
    },
    onSuccess: (result) => {
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setPending(null);
      remarkForm.resetFields();
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  const close = useMutation({
    mutationFn: (values: { closeReason: string }) =>
      courseApi.close(course.id, values.closeReason, course.version),
    onSuccess: () => {
      message.success('关闭原因已记录，课程开发状态已变更');
      setClosing(false);
      closeForm.resetFields();
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '关闭失败，请重试'),
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
              onClose={field.stateField === COURSE_STATE_FIELDS.main ? () => setClosing(true) : undefined}
            />
          ))}
          {course.closeReason && (
            <Descriptions size="small" column={1} items={[{ key: 'reason', label: '关闭原因', children: course.closeReason }]} />
          )}
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

      <Modal
        open={closing}
        title="关闭课程开发"
        okText="确认关闭"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={close.isPending}
        onCancel={() => setClosing(false)}
        onOk={() => void closeForm.validateFields().then((values) => close.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">
            关闭后该课程退出预警范围，相关待办一并关闭。关闭原因必填，它是日后回看「这门课为什么没做下去」的唯一依据。
          </Text>
          <Form form={closeForm} layout="vertical" requiredMark={false}>
            <Form.Item
              label="关闭原因"
              name="closeReason"
              rules={[{ required: true, message: '请填写关闭原因' }]}
            >
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  );
}

/** 「关闭课程开发」走独立接口：状态与必填的关闭原因必须一起成功。 */
const CLOSE_ACTION = 'CLOSE_DEVELOPMENT';

/**
 * 这些动作<b>不允许在状态区直接执行</b>，它们的状态变更是录入业务字段时的一部分。
 *
 * <p>在这里点一下「录入结论=通过」，课程主状态会变成「试讲」，而评审记录里没有任何结论——
 * 从此这门课的评审轮次与主状态对不上，而且没有任何提示。因此按钮照常显示（运营需要知道
 * 下一步是什么），但点击引导到对应页签。
 */
export const DELEGATED_ACTIONS: Record<string, string> = {
  REVIEW_PASS: '评审记录',
  REVIEW_REJECT_REVISE: '评审记录',
  REVIEW_REJECT_CLOSE: '评审记录',
  TRIAL_COURSE_PASS: '试讲记录',
  TRIAL_COURSE_FAIL: '试讲记录',
};

interface FieldRowProps {
  field: FieldAvailability;
  showActions: boolean;
  onPick: (option: ActionOption) => void;
  /** 只有主状态那一行有「关闭课程开发」 */
  onClose?: () => void;
}

function FieldRow({ field, showActions, onPick, onClose }: FieldRowProps) {
  const closeOption = field.actions.find((option) => option.action === CLOSE_ACTION);
  const plainOptions = field.actions.filter(
    (option) => option.action !== CLOSE_ACTION && !DELEGATED_ACTIONS[option.action],
  );
  const delegated = field.actions.filter(
    (option) => DELEGATED_ACTIONS[option.action] && field.allowedActions.includes(option.label),
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
      <Text style={{ width: 96, color: neutral[600] }}>{field.stateField}</Text>
      <Tag color={field.terminal ? 'default' : 'blue'}>{field.currentState ?? '（空）'}</Tag>
      {showActions && (
        <>
          <ActionGuard
            availability={{ allowedActions: field.allowedActions, blockedActions: field.blockedActions }}
            actions={[
              ...plainOptions.map((option) => ({
                action: option.label,
                onClick: () => onPick(option),
              })),
              ...(closeOption && onClose
                ? [{ action: closeOption.label, danger: true, onClick: onClose }]
                : []),
            ]}
          />
          {delegated.map((option) => (
            <Tooltip
              key={option.action}
              title={`结论要与记录一起保存，请到「${DELEGATED_ACTIONS[option.action]}」页签录入。在这里改状态会留下一条没有结论的记录`}
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
