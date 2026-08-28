import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button, Form, Input, Modal, Select, Space, Table } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { demandApi, type Demand, type LinkedCourse } from '@/shared/api/demands';
import { courseApi } from '@/shared/api/courses';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { invalidateDemandCourseLink } from '@/shared/query/invalidateGraph';
import { space } from '@/shared/theme/designTokens';
import { DemandAttachments, DEMAND_REF_FIELDS } from './DemandAttachments';
import './DemandDetailTabs.css';

/**
 * 详情页「关联课程」页签（需求 8.4，规则 R1／R4）。
 *
 * <p>页签顶部是可跳转的外链与 Word／PPT／PDF 文档；下方仍是课程库 N:N 关联——
 * 同一份关联在课程详情页的「关联需求」页签里反向可见。
 */

const COURSE_DOC_ACCEPT =
  '.doc,.docx,.ppt,.pptx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf';

interface DemandCoursesTabProps {
  demand: Demand;
}

export function DemandCoursesTab({ demand }: DemandCoursesTabProps) {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [linking, setLinking] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [form] = Form.useForm<{ courseId: number; linkNote?: string }>();
  const [linkForm] = Form.useForm<{ courseLink?: string }>();
  const demandId = demand.id;
  const savedLink = httpLink(demand.courseLink);

  useEffect(() => {
    linkForm.setFieldsValue({ courseLink: demand.courseLink ?? undefined });
  }, [linkForm, demand.id, demand.version, demand.courseLink]);

  const links = useQuery({
    queryKey: ['demands', demandId, 'courses'],
    queryFn: () => demandApi.courses(demandId),
  });

  const candidates = useQuery({
    queryKey: ['courses', 'link-candidates', keyword],
    queryFn: () => courseApi.page({ keyword: keyword || null }, 1, 50),
    enabled: linking,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['demands', demandId] });
    invalidateDemandCourseLink(queryClient);
  };

  const saveLink = useMutation({
    mutationFn: (values: { courseLink?: string }) =>
      demandApi.saveCourseLink(demandId, {
        courseLink: values.courseLink || null,
        version: demand.version,
      }),
    onSuccess: () => {
      message.success('关联课程链接已保存');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const link = useMutation({
    mutationFn: (values: { courseId: number; linkNote?: string }) =>
      demandApi.linkCourse(demandId, values.courseId, values.linkNote ?? null),
    onSuccess: () => {
      message.success('已关联该课程');
      setLinking(false);
      form.resetFields();
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '关联失败，请重试'),
  });

  const unlink = useMutation({
    mutationFn: (courseId: number) => demandApi.unlinkCourse(demandId, courseId),
    onSuccess: () => {
      message.success('已解除关联');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '解除失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <section className="dmd-tab-section">
        <h3 className="dmd-tab-heading">关联课程</h3>
        <Form
          form={linkForm}
          layout="vertical"
          requiredMark={false}
          disabled={!isOperator}
          onFinish={(values) => saveLink.mutate(values)}
        >
          <Form.Item
            label="课程链接"
            name="courseLink"
            extra="填写 http:// 或 https:// 开头的链接，保存后可点击跳转"
          >
            <Input placeholder="https://" />
          </Form.Item>
          {savedLink && (
            <p className="dmd-course-link">
              <a href={savedLink} target="_blank" rel="noopener noreferrer">
                {savedLink}
              </a>
            </p>
          )}
          {isOperator && (
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saveLink.isPending}>
                保存链接
              </Button>
            </Form.Item>
          )}
        </Form>
      </section>

      <section className="dmd-tab-section">
        <h3 className="dmd-tab-heading">关联文档</h3>
        <DemandAttachments
          demandId={demandId}
          refField={DEMAND_REF_FIELDS.courseDocs}
          emptyHint="可上传 Word、PPT、PDF，上传后可下载"
          accept={COURSE_DOC_ACCEPT}
        />
      </section>

      <Alert
        type="info"
        showIcon
        message="课程库关联两边都能看"
        description="在这里建立的课程库关联，会同时出现在对应课程详情页的「关联需求」页签里。解除关联只解除关系本身，不影响课程与需求各自的数据。"
      />

      <Table<LinkedCourse>
        size="small"
        rowKey={(row) => String(row.courseId)}
        dataSource={links.data ?? []}
        loading={links.isLoading}
        pagination={false}
        locale={{ emptyText: '这条需求还没有关联课程库中的课程' }}
        title={() =>
          isOperator && (
            <Button size="small" type="primary" icon={<Plus size={14} />} onClick={() => setLinking(true)}>
              从课程库关联
            </Button>
          )
        }
        columns={[
          { title: '课程ID', dataIndex: 'courseNo', width: 130 },
          {
            title: '课程名称',
            dataIndex: 'courseName',
            render: (_: string, row) => (
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/courses/${row.courseId}`)}>
                {row.courseName}
              </Button>
            ),
          },
          { title: '课程主状态', dataIndex: 'mainState', width: 120 },
          {
            title: '课程负责人',
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
                      content: `解除后「${row.courseName}」的详情页不再显示这条需求。解除动作会记入操作审计日志。`,
                      okText: '解除',
                      okButtonProps: { danger: true },
                      cancelText: '取消',
                      onOk: () => unlink.mutateAsync(row.courseId),
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
        title="从课程库关联"
        okText="关联"
        cancelText="取消"
        confirmLoading={link.isPending}
        onCancel={() => setLinking(false)}
        onOk={() => void form.validateFields().then((values) => link.mutateAsync(values))}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="选择课程" name="courseId" rules={[{ required: true, message: '请选择要关联的课程' }]}>
            <Select
              showSearch
              filterOption={false}
              placeholder="按课程ID或名称搜索"
              onSearch={setKeyword}
              loading={candidates.isLoading}
              options={(candidates.data?.records ?? []).map((course) => ({
                value: course.id,
                label: `${course.courseName}（${course.courseNo}·${course.mainState}）`,
              }))}
            />
          </Form.Item>
          <Form.Item label="关联说明" name="linkNote" extra="这条需求与该课程的关系，例如覆盖了需求的哪一部分">
            <Input maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export function httpLink(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://') ? value : null;
}
