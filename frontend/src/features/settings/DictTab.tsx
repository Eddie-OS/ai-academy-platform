import { useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Space, Switch, Tabs, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { space } from '@/shared/theme/designTokens';
import { ApiError } from '@/shared/api/client';
import { configApi, type DictItem, type DictItemForm, type DictTypeOption } from '@/shared/api/config';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { useClientPaging } from '@/shared/hooks/useClientPaging';

/**
 * Tab 2 · 字典配置（需求 13.9.3）。每类字典一张子表。
 *
 * <p>三条规则在界面上必须看得见，而不是等保存被后端拒绝：
 * <ul>
 *   <li>DC2 编码一经创建不可修改——编辑时编码输入框禁用（历史数据存的是编码，改编码等于
 *       静默改写历史记录的含义）；
 *   <li>DC1 已被引用的字典项不可删，只可停用——删除按钮的失败提示会说明引用处数，
 *       但更重要的是把「停用」摆在旁边，让运营知道正确的做法是什么；
 *   <li>DC4 作战单元不允许删到少于 1 条——首页分组维度不能为空。
 * </ul>
 */
export function DictTab() {
  const types = useQuery({ queryKey: ['config', 'dict-types'], queryFn: () => configApi.dictTypes() });

  if (!types.data) {
    return null;
  }

  return (
    <Tabs
      tabPosition="left"
      items={types.data.map((type) => ({
        key: type.dictType,
        label: type.dictType,
        children: <DictItemTable type={type} />,
      }))}
    />
  );
}

function DictItemTable({ type }: { type: DictTypeOption }) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DictItem | 'new' | null>(null);
  const [form] = Form.useForm<DictItemForm>();

  const items = useQuery({
    queryKey: ['config', 'dicts', type.dictType],
    queryFn: () => configApi.dictItems(type.dictType),
  });
  const paging = useClientPaging(items.data);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['config', 'dicts', type.dictType] });
    // 字典项同时通过 /api/meta/dicts 下发给各页面的下拉框
    void queryClient.invalidateQueries({ queryKey: ['meta'] });
  };

  const save = useMutation({
    mutationFn: (values: DictItemForm) =>
      editing === 'new' || editing === null
        ? configApi.createDictItem(type.dictType, values).then(() => undefined)
        : configApi.updateDictItem(editing.id, values),
    onSuccess: () => {
      message.success('字典项已保存');
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => configApi.deleteDictItem(id),
    onSuccess: () => {
      message.success('字典项已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const confirmRemove = (item: DictItem) => {
    modal.confirm({
      title: `删除字典项「${item.itemName}」`,
      content:
        '已被业务数据引用的字典项不能删除，只能停用——停用后历史数据照旧显示，只是新建时不再可选。若确认这一项从未被引用，可以继续删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '不删除',
      onOk: () => remove.mutateAsync(item.id),
    });
  };

  const columns: DataTableColumn<DictItem>[] = [
    { key: 'itemCode', title: '编码', kind: 'code', dataIndex: 'itemCode' },
    { key: 'itemName', title: '名称', kind: 'name', dataIndex: 'itemName' },
    ...(type.hierarchical
      ? [{ key: 'parentCode', title: '上级分类', kind: 'code' as const, dataIndex: 'parentCode' as const }]
      : []),
    { key: 'seqNo', title: '排序号', kind: 'number', dataIndex: 'seqNo' },
    {
      key: 'enabled',
      title: '启用状态',
      kind: 'statusSub',
      render: (row) => (row.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    { key: 'updatedBy', title: '最后修改人', kind: 'person', dataIndex: 'updatedBy' },
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
                itemCode: row.itemCode,
                itemName: row.itemName,
                parentCode: row.parentCode,
                seqNo: row.seqNo,
                enabled: row.enabled,
              });
            }}
          >
            编辑
          </Button>
          <Button type="link" size="small" danger style={{ padding: 0 }} onClick={() => confirmRemove(row)}>
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
        message="停用与删除不是同一件事"
        description="停用只影响新建时的可选项，已经引用它的历史数据不受影响；删除只在从未被引用时可行。日常调整字典请优先用停用。"
      />

      <DataTable<DictItem>
        storageKey={`config-dict-${type.dictType}`}
        columns={columns}
        rows={paging.rows}
        rowKey={(row) => String(row.id)}
        total={paging.total}
        pageNum={paging.pageNum}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        loading={items.isLoading}
        error={items.isError ? '字典项没有取到。' : null}
        onReload={() => void items.refetch()}
        objectName={`${type.dictType}字典项`}
        emptyDescription="字典项决定各页面下拉框里能选到什么。新增一项后，新建业务对象时即可选到它。"
        toolbarExtra={
          <Button
            type="primary"
            size="small"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditing('new');
              form.resetFields();
              form.setFieldsValue({ seqNo: (paging.total + 1) * 10, enabled: true });
            }}
          >
            新增字典项
          </Button>
        }
      />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? `新增「${type.dictType}」字典项` : '编辑字典项'}
        okText="保存"
        cancelText="取消"
        confirmLoading={save.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => {
          void form.validateFields().then((values) => save.mutateAsync(values));
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="编码"
            name="itemCode"
            extra={editing === 'new' ? '大写字母、数字与下划线。创建后不可修改' : '编码一经创建不可修改（规则 DC2）'}
            rules={[
              { required: true, message: '请填写编码' },
              { pattern: /^[A-Z0-9_]{1,64}$/, message: '编码只能是大写字母、数字与下划线，最长 64 位' },
            ]}
          >
            <Input disabled={editing !== 'new'} />
          </Form.Item>
          <Form.Item label="名称" name="itemName" rules={[{ required: true, message: '请填写名称' }]}>
            <Input maxLength={200} />
          </Form.Item>
          {type.hierarchical && (
            <Form.Item label="上级分类编码" name="parentCode" extra="留空表示一级分类">
              <Input />
            </Form.Item>
          )}
          <Form.Item
            label="排序号"
            name="seqNo"
            extra="决定下拉选项的顺序，相同排序号按编码升序（规则 DC3）"
            rules={[{ required: true, message: '请填写排序号' }]}
          >
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
