import { useState } from 'react';
import { App, Form, Input, Modal, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { COURSE_OBJECT_TYPE, courseApi, type Course } from '@/shared/api/courses';
import { transitionApi, type ActionOption } from '@/shared/api/transitions';
import { ActionGuard } from '@/shared/ui/ActionGuard';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { invalidateCourseListAndMetrics } from './courseFilters';
import { COURSE_STATE_FIELDS } from './courseMeta';
import { DELEGATED_ACTIONS } from './CourseTransitionPanel';

const { Text } = Typography;

const CLOSE_ACTION = 'CLOSE_DEVELOPMENT';

interface CoursePhaseActionsProps {
  course: Course;
  /** 只展示该状态字段上的动作 */
  stateField: string;
  /** 额外放行的主状态动作码（如开发页签上的「提交评审」） */
  extraMainActions?: string[];
  /** 是否包含「关闭课程开发」 */
  includeClose?: boolean;
}

/**
 * 按页签拆开的状态动作。详情头上不再放结论按钮组：录入结论只在评审/试讲页签，
 * 提交评审在开发页签，关闭课程开发在立项页签。
 */
export function CoursePhaseActions({
  course,
  stateField,
  extraMainActions = [],
  includeClose = false,
}: CoursePhaseActionsProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [pending, setPending] = useState<ActionOption | null>(null);
  const [closing, setClosing] = useState(false);
  const [remarkForm] = Form.useForm<{ remark?: string }>();
  const [closeForm] = Form.useForm<{ closeReason: string }>();

  const availability = useQuery({
    queryKey: ['courses', course.id, 'available'],
    queryFn: () => transitionApi.available(COURSE_OBJECT_TYPE, course.id),
  });

  const field = availability.data?.fields.find((item) => item.stateField === stateField);
  const mainField = availability.data?.fields.find((item) => item.stateField === COURSE_STATE_FIELDS.main);

  const extras = (mainField?.actions ?? []).filter((option) => extraMainActions.includes(option.action));
  const own = (field?.actions ?? []).filter(
    (option) =>
      option.action !== CLOSE_ACTION &&
      !DELEGATED_ACTIONS[option.action] &&
      (stateField !== COURSE_STATE_FIELDS.main || extraMainActions.length === 0 || extraMainActions.includes(option.action)),
  );
  const seen = new Set<string>();
  const options = [...own, ...extras].filter((option) => {
    if (seen.has(option.action)) return false;
    seen.add(option.action);
    return true;
  });
  const closeOption = includeClose
    ? mainField?.actions.find((option) => option.action === CLOSE_ACTION)
    : undefined;

  const transit = useMutation({
    mutationFn: (values: { remark?: string }) => {
      if (!pending) throw new Error('没有选中任何动作');
      const fieldName = extraMainActions.includes(pending.action) && field?.stateField !== COURSE_STATE_FIELDS.main
        ? COURSE_STATE_FIELDS.main
        : (field?.stateField ?? COURSE_STATE_FIELDS.main);
      return transitionApi.transit(COURSE_OBJECT_TYPE, course.id, {
        stateField: fieldName,
        action: pending.action,
        version: course.version,
        remark: values.remark ?? null,
      });
    },
    onSuccess: (result) => {
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setPending(null);
      remarkForm.resetFields();
      invalidateCourseListAndMetrics(queryClient);
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
      invalidateCourseListAndMetrics(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '关闭失败，请重试'),
  });

  if (!isOperator || (options.length === 0 && !closeOption)) {
    return null;
  }

  return (
    <>
      <ActionGuard
        availability={{
          allowedActions: [...(field?.allowedActions ?? []), ...(mainField?.allowedActions ?? [])],
          blockedActions: [...(field?.blockedActions ?? []), ...(mainField?.blockedActions ?? [])],
        }}
        actions={[
          ...options.map((option) => ({
            action: option.label,
            onClick: () => setPending(option),
          })),
          ...(closeOption
            ? [{ action: closeOption.label, danger: true, onClick: () => setClosing(true) }]
            : []),
        ]}
      />

      <Modal
        open={pending !== null}
        title={pending?.label}
        okText="确认变更"
        cancelText="取消"
        confirmLoading={transit.isPending}
        onCancel={() => setPending(null)}
        onOk={() => void remarkForm.validateFields().then((values) => transit.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">变更后状态为「{pending?.toState}」。状态变更会写入流转日志。</Text>
          <Form form={remarkForm} layout="vertical" requiredMark={false}>
            <Form.Item label="变更说明" name="remark">
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
        <Form form={closeForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="关闭原因"
            name="closeReason"
            rules={[{ required: true, message: '请填写关闭原因' }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
