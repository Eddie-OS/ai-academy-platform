import { useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { valueReportsApi, type ValueReport, type ValueReportForm } from '@/shared/api/valueReports';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';

/**
 * 业务价值人工填报（需求 7.8／15.6）。一期不做自动回收（N14）。
 */
export function ValueReportsPage() {
  const isOperator = useIsOperator();
  const year = new Date().getFullYear();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ['value-reports', year],
    queryFn: () => valueReportsApi.list(year),
  });
  const summary = useQuery({
    queryKey: ['value-reports', 'summary', year],
    queryFn: () => valueReportsApi.summary(year),
  });
  const create = useMutation({
    mutationFn: (form: ValueReportForm) => valueReportsApi.create(form),
    onSuccess: () => {
      message.success('已保存');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['value-reports'] });
    },
  });

  return (
    <div style={{ padding: space.lg }}>
      <Space style={{ marginBottom: space.md }} wrap>
        <h1 style={{ margin: 0, fontSize: 20 }}>业务价值填报</h1>
        <span>
          {year} 年 · 效率改善 {summary.data?.efficiencyGainCount ?? '—'} 条 · 质量改善{' '}
          {summary.data?.qualityGainCount ?? '—'} 条
        </span>
        {isOperator && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
            新建填报
          </Button>
        )}
      </Space>
      <Table<ValueReport>
        rowKey="id"
        loading={list.isLoading}
        dataSource={list.data ?? []}
        pagination={false}
        columns={[
          { title: '期间', dataIndex: 'reportPeriod', width: 100 },
          { title: '效率提升', dataIndex: 'efficiencyGain', ellipsis: true },
          { title: '质量改善', dataIndex: 'qualityGain', ellipsis: true },
          {
            title: '成本节约',
            render: (_, r) =>
              r.costSaving == null ? '—' : `${r.costSaving} ${r.costSavingUnit ?? ''}`.trim(),
          },
          { title: '说明', dataIndex: 'description', ellipsis: true },
        ]}
      />
      <Modal
        title="新建业务价值填报"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          layout="vertical"
          onFinish={(values) => create.mutate(values as ValueReportForm)}
          initialValues={{ reportPeriod: `${year}-01` }}
        >
          <Form.Item
            name="reportPeriod"
            label="填报期间"
            rules={[{ required: true, pattern: /^\d{4}-\d{2}$/, message: '格式 2026-07' }]}
          >
            <Input placeholder="2026-07" />
          </Form.Item>
          <Form.Item name="efficiencyGain" label="效率提升值">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="qualityGain" label="质量改善值">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="costSaving" label="成本节约值">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="costSavingUnit" label="单位">
            <Select
              allowClear
              options={[
                { value: '万元', label: '万元' },
                { value: '人天', label: '人天' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={create.isPending} block>
            保存
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
