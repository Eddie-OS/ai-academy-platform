import { useState } from 'react';
import { Alert, App, Button, Form, InputNumber, Modal, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { space } from '@/shared/theme/designTokens';
import { ApiError } from '@/shared/api/client';
import { configApi, type ThresholdRow } from '@/shared/api/config';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';
import { useClientPaging } from '@/shared/hooks/useClientPaging';

/**
 * Tab 1 · 三色灯阈值（需求 13.9.2）。四行固定，不可增删。
 *
 * <p><b>编辑走弹窗而不是行内编辑</b>（表格禁则 TB7）：所有变更都要留痕并校验合法性，
 * 行内编辑承载不了确认与日志写入。这里的每一次保存都会写操作审计日志（13.9.1）。
 */
export function ThresholdTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ThresholdRow | null>(null);
  const [form] = Form.useForm<{ blueDays: number; redDays: number }>();

  const thresholds = useQuery({ queryKey: ['config', 'thresholds'], queryFn: () => configApi.thresholds() });
  const paging = useClientPaging(thresholds.data);

  const save = useMutation({
    mutationFn: (values: { id: number; blueDays: number; redDays: number }) =>
      configApi.updateThreshold(values.id, values.blueDays, values.redDays),
    onSuccess: () => {
      message.success('阈值已保存，灯色按新阈值实时重算');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['config', 'thresholds'] });
      // 阈值同时通过 /api/meta/thresholds 下发给各页面，改完要一起失效
      void queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const columns: DataTableColumn<ThresholdRow>[] = [
    { key: 'objectType', title: '对象类型', kind: 'combatUnit', dataIndex: 'objectType' },
    { key: 'blueDays', title: '蓝灯阈值（天）', kind: 'number', dataIndex: 'blueDays' },
    { key: 'redDays', title: '红灯阈值（天）', kind: 'number', dataIndex: 'redDays' },
    { key: 'expectFinishField', title: '预计完成时间取值字段', kind: 'name', dataIndex: 'expectFinishField' },
    { key: 'updatedBy', title: '最后修改人', kind: 'person', dataIndex: 'updatedBy' },
    {
      key: 'updatedAt',
      title: '最后修改时间',
      kind: 'datetime',
      render: (row) => row.updatedAt?.replace('T', ' ').slice(0, 16) ?? null,
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
            form.setFieldsValue({ blueDays: row.blueDays, redDays: row.redDays });
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
        message="蓝灯是「即将到期」这一级预警，不是健康态"
        description="V-9：蓝灯 = 距预计完成时间尚有余量（剩余天数大于蓝灯阈值）；黄灯 = 临近预计完成（剩余 0～蓝灯阈值天）；红灯 = 已逾期或状态连续超过红灯阈值未变更。停滞优先于逾期，二者均为红灯并用文案区分成因。"
      />

      <DataTable<ThresholdRow>
        storageKey="config-thresholds"
        columns={columns}
        rows={paging.rows}
        rowKey={(row) => String(row.id)}
        total={paging.total}
        pageNum={paging.pageNum}
        pageSize={paging.pageSize}
        onPageChange={paging.onPageChange}
        loading={thresholds.isLoading}
        error={thresholds.isError ? '阈值配置没有取到。' : null}
        onReload={() => void thresholds.refetch()}
        objectName="阈值配置"
      />

      <Modal
        open={editing !== null}
        title={`编辑「${editing?.objectType ?? ''}」的三色灯阈值`}
        okText="保存"
        cancelText="取消"
        confirmLoading={save.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => {
          void form.validateFields().then((values) => {
            if (editing) {
              return save.mutateAsync({ id: editing.id, ...values });
            }
          });
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="蓝灯阈值（天）"
            name="blueDays"
            extra="距预计完成时间不足这么多天时报蓝灯。取值 1–30"
            rules={[{ required: true, message: '请填写蓝灯阈值' }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="红灯阈值（天）"
            name="redDays"
            extra="状态连续超过这么多天没变更时报红灯。取值 1–90"
            rules={[{ required: true, message: '请填写红灯阈值' }]}
          >
            <InputNumber min={1} max={90} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
