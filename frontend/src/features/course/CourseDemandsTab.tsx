import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Form, Input, Modal, Select, Space, Table } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { demandApi, type LinkedDemand } from '@/shared/api/demands';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';

/**
 * 课程详情页「关联需求」页签（需求 9.2、8.4，规则 R4「关联关系必须双向可查」）。
 *
 * <p>与需求详情页的「关联课程」页签是<b>同一份关联的两个视角</b>：两侧调的是同一个服务，
 * 校验与留痕因此不会长歪。从哪一侧建立关联都一样，不存在「主表」与「从表」之分。
 */

interface CourseDemandsTabProps {
  courseId: number;
}

export function CourseDemandsTab({ courseId }: CourseDemandsTabProps) {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [linking, setLinking] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [form] = Form.useForm<{ demandId: number; linkNote?: string }>();

  const links = useQuery({
    queryKey: ['courses', courseId, 'demands'],
    queryFn: () => demandApi.demandsOfCourse(courseId),
  });

  const candidates = useQuery({
    queryKey: ['demands', 'link-candidates', keyword],
    queryFn: () => demandApi.page({ keyword: keyword || null }, 1, 50),
    enabled: linking,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
    void queryClient.invalidateQueries({ queryKey: ['demands'] });
  };

  const link = useMutation({
    mutationFn: (values: { demandId: number; linkNote?: string }) =>
      demandApi.linkDemandFromCourse(courseId, values.demandId, values.linkNote ?? null),
    onSuccess: () => {
      message.success('已关联该需求');
      setLinking(false);
      form.resetFields();
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '关联失败，请重试'),
  });

  const unlink = useMutation({
    mutationFn: (demandId: number) => demandApi.unlinkDemandFromCourse(courseId, demandId),
    onSuccess: () => {
      message.success('已解除关联');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '解除失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="关联关系两边都能看"
        description="在这里建立的关联，会同时出现在对应需求详情页的「关联课程」页签里。一门课可以同时覆盖多条需求。"
      />

      <Table<LinkedDemand>
        size="small"
        rowKey={(row) => String(row.demandId)}
        dataSource={links.data ?? []}
        loading={links.isLoading}
        pagination={false}
        locale={{ emptyText: '这门课还没有关联需求' }}
        title={() =>
          isOperator && (
            <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setLinking(true)}>
              关联需求
            </Button>
          )
        }
        columns={[
          { title: '需求ID', dataIndex: 'demandNo', width: 130 },
          {
            title: '需求名称',
            dataIndex: 'demandName',
            render: (_: string, row) => (
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/demands/${row.demandId}`)}>
                {row.demandName}
              </Button>
            ),
          },
          { title: '评审状态', dataIndex: 'reviewState', width: 110 },
          { title: '分流出口', dataIndex: 'outlet', width: 180, render: (v: string | null) => v ?? '—' },
          {
            title: '需求负责人',
            dataIndex: 'ownerName',
            width: 120,
            render: (_: string | null, row) => row.ownerName ?? row.ownerNo,
          },
          { title: '关联说明', dataIndex: 'linkNote', render: (v: string | null) => v ?? '—' },
          { title: '关联时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
          {
            title: '操作',
            key: 'actions',
            width: 100,
            align: 'right',
            render: (_, row) =>
              isOperator && (
                <Button
                  type="link"
                  size="small"
                  danger
                  style={{ padding: 0 }}
                  onClick={() =>
                    modal.confirm({
                      title: '解除关联',
                      content: `解除后「${row.demandName}」的详情页不再显示这门课。解除动作会记入操作审计日志。`,
                      okText: '解除',
                      okButtonProps: { danger: true },
                      cancelText: '取消',
                      onOk: () => unlink.mutateAsync(row.demandId),
                    })
                  }
                >
                  解除关联
                </Button>
              ),
          },
        ]}
      />

      <Modal
        open={linking}
        title="关联需求"
        okText="关联"
        cancelText="取消"
        confirmLoading={link.isPending}
        onCancel={() => setLinking(false)}
        onOk={() => void form.validateFields().then((values) => link.mutateAsync(values))}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="选择需求" name="demandId" rules={[{ required: true, message: '请选择要关联的需求' }]}>
            <Select
              showSearch
              filterOption={false}
              placeholder="按需求ID或名称搜索"
              onSearch={setKeyword}
              loading={candidates.isLoading}
              options={(candidates.data?.records ?? []).map((demand) => ({
                value: demand.id,
                label: `${demand.demandName}（${demand.demandNo}·${demand.reviewState}）`,
              }))}
            />
          </Form.Item>
          <Form.Item label="关联说明" name="linkNote" extra="这门课与该需求的关系，例如覆盖了需求的哪一部分">
            <Input maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
