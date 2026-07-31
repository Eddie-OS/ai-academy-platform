import { useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Space, Switch, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { space } from '@/shared/theme/designTokens';
import { ApiError } from '@/shared/api/client';
import { configApi, type DeriveRuleRow } from '@/shared/api/config';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { useClientPaging } from '@/shared/hooks/useClientPaging';

/**
 * Tab 4 · 任务派生规则（需求 13.1.2）。
 *
 * <p>规则本身（哪个状态派生哪种任务、负责人取谁）是确定性的业务逻辑，不开放配置；
 * 可配的是需求明确要求「须支持后台配置」的三项：任务标题模板、默认截止天数、是否启用。
 *
 * <p>「截止日取自对象字段」的规则（如课程开发取期望上线日）不填默认天数——
 * 那类任务的截止日是业务日期，不是「创建后 N 天」。界面上禁用天数输入框并说明原因，
 * 比让运营填一个不生效的值要好。
 */
export function DeriveRuleTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DeriveRuleRow | null>(null);
  const [form] = Form.useForm<{ titleTemplate: string; dueOffsetDays: number | null; enabled: boolean }>();

  const rules = useQuery({ queryKey: ['config', 'derive-rules'], queryFn: () => configApi.taskDeriveRules() });
  const paging = useClientPaging(rules.data, 50);

  const save = useMutation({
    mutationFn: (values: { titleTemplate: string; dueOffsetDays: number | null; enabled: boolean }) =>
      configApi.updateTaskDeriveRule(editing!.id, values),
    onSuccess: () => {
      message.success('派生规则已保存，此后新产生的任务按新规则创建');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['config', 'derive-rules'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const columns: DataTableColumn<DeriveRuleRow>[] = [
    { key: 'taskType', title: '任务类型', kind: 'dept', dataIndex: 'taskType' },
    { key: 'titleTemplate', title: '任务标题模板', kind: 'name', dataIndex: 'titleTemplate' },
    { key: 'ownerSource', title: '负责人取值', kind: 'combatUnit', dataIndex: 'ownerSource' },
    { key: 'dueBaseLabel', title: '截止日基准', kind: 'dept', dataIndex: 'dueBaseLabel' },
    {
      key: 'dueOffsetDays',
      title: '默认截止天数',
      kind: 'number',
      // 取对象字段的规则没有「天数」这个概念，空值渲染成 — 正好表达这一点
      render: (row) => row.dueOffsetDays,
    },
    {
      key: 'enabled',
      title: '启用状态',
      kind: 'statusSub',
      render: (row) => (row.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      key: 'actions',
      title: '操作',
      kind: 'actions',
      width: actionsWidth(1),
      operatorOnly: true,
      render: (row) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={() => {
            setEditing(row);
            form.setFieldsValue({
              titleTemplate: row.titleTemplate,
              dueOffsetDays: row.dueOffsetDays,
              enabled: row.enabled,
            });
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="停用一条规则不会删除已经派生出来的任务"
        description="停用只影响此后的状态变更：已在任务中心的任务照旧存在，需要单独处理。同样，改截止天数只对新任务生效，不会重算历史任务的截止日。"
      />

      <DataTable<DeriveRuleRow>
        storageKey="config-derive-rules"
        columns={columns}
        rows={paging.rows}
        rowKey={(row) => String(row.id)}
        total={paging.total}
        pageNum={paging.pageNum}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        loading={rules.isLoading}
        error={rules.isError ? '任务派生规则没有取到。' : null}
        onReload={() => void rules.refetch()}
        objectName="任务派生规则"
      />

      <Modal
        open={editing !== null}
        title={`编辑「${editing?.taskType ?? ''}」派生规则`}
        okText="保存"
        cancelText="取消"
        width={560}
        confirmLoading={save.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => {
          void form.validateFields().then((values) => save.mutateAsync(values));
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="任务标题模板"
            name="titleTemplate"
            extra="可用占位符 {对象名称}。任务中心里显示的就是这句话，写清「要做什么」比写对象名更有用"
            rules={[{ required: true, message: '请填写任务标题模板' }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            label="默认截止天数"
            name="dueOffsetDays"
            extra={
              editing?.fixedByObjectField
                ? `这条规则的截止日取自${editing.dueBaseLabel}，不使用默认天数`
                : `自${editing?.dueBaseLabel ?? '基准日'}起算。取值 1–365`
            }
            rules={
              editing?.fixedByObjectField ? [] : [{ required: true, message: '请填写默认截止天数' }]
            }
          >
            <InputNumber
              min={1}
              max={365}
              style={{ width: '100%' }}
              disabled={editing?.fixedByObjectField}
            />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
