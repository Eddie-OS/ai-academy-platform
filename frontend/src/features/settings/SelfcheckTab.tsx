import { useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag, Tooltip } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus } from 'lucide-react';
import { space } from '@/shared/theme/designTokens';
import { ApiError } from '@/shared/api/client';
import { configApi, type SelfcheckItem, type SelfcheckItemForm } from '@/shared/api/config';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { useClientPaging } from '@/shared/hooks/useClientPaging';

/**
 * Tab 3 · 自检 CheckList 题库（需求 9.4.1、《课程自检CheckList初版》三）。
 *
 * <p>题库的四个分组与 14 个初始条目由 Flyway 的 R__ 脚本装载，这里是运营调整入口。
 *
 * <p><b>锁定条目（locked）的处理是这个 Tab 最容易做错的地方。</b>需求 9.4.1 列明的 5 条
 * 不允许停用，但<b>允许改文案</b>——它们是课程立项自检的底线问题，不是不可动的字面。
 * 因此界面上锁定条目的「启用」开关禁用并给出原因，其余字段照常可编辑。
 */
export function SelfcheckTab() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SelfcheckItem | 'new' | null>(null);
  const [form] = Form.useForm<SelfcheckItemForm>();

  const items = useQuery({ queryKey: ['config', 'selfcheck'], queryFn: () => configApi.selfcheckItems() });
  const noteRequirements = useQuery({
    queryKey: ['config', 'note-requirements'],
    queryFn: () => configApi.noteRequirements(),
  });
  const paging = useClientPaging(items.data, 50);

  const locked = editing !== null && editing !== 'new' ? editing.locked : false;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['config', 'selfcheck'] });
    void queryClient.invalidateQueries({ queryKey: ['meta'] });
  };

  const save = useMutation({
    mutationFn: (values: SelfcheckItemForm) =>
      editing === 'new' || editing === null
        ? configApi.createSelfcheckItem(values).then(() => undefined)
        : configApi.updateSelfcheckItem(editing.id, values),
    onSuccess: () => {
      message.success('检查项已保存');
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => configApi.deleteSelfcheckItem(id),
    onSuccess: () => {
      message.success('检查项已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const columns: DataTableColumn<SelfcheckItem>[] = [
    { key: 'groupName', title: '分组', kind: 'dept', dataIndex: 'groupName' },
    { key: 'seq', title: '序号', kind: 'number', dataIndex: 'seq' },
    {
      key: 'itemText',
      title: '检查项',
      kind: 'name',
      render: (row) => (
        <Space size={4}>
          {row.locked && (
            <Tooltip title="需求 9.4.1 列明的必检项：可以改文案，不能停用">
              <Lock size={12} />
            </Tooltip>
          )}
          {row.itemText}
        </Space>
      ),
    },
    { key: 'noteRequirement', title: '说明', kind: 'training', dataIndex: 'noteRequirement' },
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
      width: actionsWidth(2),
      operatorOnly: true,
      render: (row) => (
        <Space size={space.md}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => {
              setEditing(row);
              form.setFieldsValue({
                groupName: row.groupName,
                seq: row.seq,
                itemText: row.itemText,
                noteRequirement: row.noteRequirement,
                guideText: row.guideText,
                enabled: row.enabled,
              });
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            style={{ padding: 0 }}
            disabled={row.locked}
            title={row.locked ? '需求列明的必检项不能删除' : undefined}
            onClick={() =>
              modal.confirm({
                title: `删除检查项「${row.itemText}」`,
                content:
                  '已被课程自检记录引用的检查项不能删除，只能停用——停用后历史自检记录照旧可查，但不再计入完成度分母（规则 CK5）。',
                okText: '删除',
                okButtonProps: { danger: true },
                cancelText: '不删除',
                onOk: () => remove.mutateAsync(row.id),
              })
            }
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="说明的必填性有三档，不是一个勾选框"
        description="「必填」的条目勾选但没填说明视为未完成（规则 CK2）；「选填」给输入框但不校验；「无」不给输入框。把「是否必检」和「说明是否必填」当成同一件事，会让自检流于形式。"
      />

      <DataTable<SelfcheckItem>
        storageKey="config-selfcheck"
        columns={columns}
        rows={paging.rows}
        rowKey={(row) => String(row.id)}
        total={paging.total}
        pageNum={paging.pageNum}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        loading={items.isLoading}
        error={items.isError ? '自检题库没有取到。' : null}
        onReload={() => void items.refetch()}
        objectName="自检检查项"
        toolbarExtra={
          <Button
            type="primary"
            size="small"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditing('new');
              form.resetFields();
              form.setFieldsValue({
                seq: (items.data?.length ?? 0) * 10 + 10,
                enabled: true,
                noteRequirement: noteRequirements.data?.[1],
              });
            }}
          >
            新增检查项
          </Button>
        }
      />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? '新增检查项' : '编辑检查项'}
        okText="保存"
        cancelText="取消"
        width={640}
        confirmLoading={save.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => {
          void form.validateFields().then((values) => save.mutateAsync(values));
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="所属分组"
            name="groupName"
            extra="如「A 立项必要性」。分组名相同的条目在自检界面归为一组"
            rules={[{ required: true, message: '请填写所属分组' }]}
          >
            <Input maxLength={32} />
          </Form.Item>
          <Form.Item
            label="序号"
            name="seq"
            extra="决定自检界面的条目顺序。建议留出间隔（10、20、30…），插入新条目时不用重排"
            rules={[{ required: true, message: '请填写序号' }]}
          >
            <InputNumber min={1} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="检查项" name="itemText" rules={[{ required: true, message: '请填写检查项描述' }]}>
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Form.Item
            label="说明的必填性"
            name="noteRequirement"
            rules={[{ required: true, message: '请选择说明的必填性' }]}
          >
            <Select
              options={(noteRequirements.data ?? []).map((value) => ({ value, label: value }))}
              loading={noteRequirements.isLoading}
            />
          </Form.Item>
          <Form.Item
            label="填写指引"
            name="guideText"
            extra="写给填自检的人看：这一项要写清什么、什么样的答案是无效的"
          >
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Form.Item
            label="启用"
            name="enabled"
            valuePropName="checked"
            extra={locked ? '需求 9.4.1 列明的必检项不允许停用，但可以改文案' : undefined}
          >
            <Switch disabled={locked} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
