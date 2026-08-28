import { App, Button, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { configApi, type EscalationConfigForm } from '@/shared/api/config';
import { space } from '@/shared/theme/designTokens';

/**
 * Tab · 催办配置（需求 13.9.5）。不包含任何发送渠道配置。
 */
export function EscalationConfigTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<EscalationConfigForm>();

  const query = useQuery({
    queryKey: ['config', 'escalation'],
    queryFn: () => configApi.escalation(),
  });

  const save = useMutation({
    mutationFn: (values: EscalationConfigForm) => configApi.updateEscalation(query.data!.id, values),
    onSuccess: () => {
      message.success('催办配置已保存');
      void queryClient.invalidateQueries({ queryKey: ['config', 'escalation'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  if (query.data && form.getFieldValue('cycleWeekday') == null) {
    form.setFieldsValue({
      cycleWeekday: query.data.cycleWeekday,
      cycleTime: query.data.cycleTime.slice(0, 5),
      listEnabled: query.data.listEnabled,
      appendBlue: query.data.appendBlue,
      appendYellow: query.data.appendYellow,
      appendRed: query.data.appendRed,
      templateText: query.data.templateText,
      minIntervalHours: query.data.minIntervalHours,
      preSessionDays: query.data.preSessionDays,
    });
  }

  return (
    <Form
      form={form}
      layout="vertical"
      style={{ maxWidth: 720 }}
      onFinish={(values) => save.mutate(values)}
    >
      <Form.Item
        name="cycleWeekday"
        label="待催办清单重算周期（星期）"
        rules={[{ required: true }]}
        extra="这是「算」的时间，不是「发」的时间（RM1）。用滚动周期边界实现，无每周一定时任务。"
      >
        <Select
          options={[
            { value: 1, label: '周一' },
            { value: 2, label: '周二' },
            { value: 3, label: '周三' },
            { value: 4, label: '周四' },
            { value: 5, label: '周五' },
            { value: 6, label: '周六' },
            { value: 7, label: '周日' },
          ]}
        />
      </Form.Item>
      <Form.Item name="cycleTime" label="重算时刻" rules={[{ required: true }]} extra="格式 HH:mm，默认 09:00">
        <Input placeholder="09:00" />
      </Form.Item>
      <Form.Item name="listEnabled" label="待催办清单启用" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="仅灯色追加" />
      </Form.Item>
      <Space size={space.lg} wrap>
        <Form.Item name="appendBlue" label="蓝灯变化追加" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="appendYellow" label="黄灯变化追加" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="appendRed" label="红灯变化追加" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Space>
      <Form.Item
        name="templateText"
        label="催办默认模板文案"
        rules={[{ required: true }]}
        extra="占位符：{对象名称}、{当前状态}、{剩余天数}、{负责人姓名}"
      >
        <Input.TextArea rows={4} />
      </Form.Item>
      <Form.Item name="minIntervalHours" label="重复记台账最小间隔（小时）" rules={[{ required: true }]}>
        <InputNumber min={1} max={168} style={{ width: 160 }} />
      </Form.Item>
      <Form.Item name="preSessionDays" label="开课前提醒天数" rules={[{ required: true }]}>
        <InputNumber min={0} max={30} style={{ width: 160 }} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={save.isPending} disabled={!query.data}>
        保存
      </Button>
    </Form>
  );
}
