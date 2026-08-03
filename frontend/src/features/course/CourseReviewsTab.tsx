import { useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type CourseReview } from '@/shared/api/courses';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './courseMeta';
import { formatDateTime } from './CourseMaterialsTab';

const { Text } = Typography;

/**
 * 详情页「评审记录」页签（需求 9.6、9.8）。
 *
 * <p><b>评审记录不能手工新建。</b>每一轮由「提交评审」这个状态动作的副作用创建，同时锁定当时的
 * 材料版本（规则 R7）。给一个「新增评审记录」按钮，就会出现没有对应材料版本的评审轮次，
 * 「这一轮评审看的是哪一版」再也说不清。
 *
 * <p><b>结论录入后记录只读。</b>录错了不是改这条记录，而是走下一轮——评审记录是线下会议的
 * 留痕，改掉它等于改历史。
 */

interface CourseReviewsTabProps {
  courseId: number;
}

interface ConclusionValues {
  reviewForms: string[];
  reviewDate: Dayjs;
  participants?: string;
  reviewResult: string;
  reviewOpinion: string;
  issueList?: string;
}

export function CourseReviewsTab({ courseId }: CourseReviewsTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const [recording, setRecording] = useState<CourseReview | null>(null);
  const [form] = Form.useForm<ConclusionValues>();

  const reviews = useQuery({
    queryKey: ['courses', courseId, 'reviews'],
    queryFn: () => courseApi.reviews(courseId),
  });

  const record = useMutation({
    mutationFn: (values: ConclusionValues) =>
      courseApi.recordReviewConclusion(recording!.id, {
        ...values,
        reviewDate: values.reviewDate.format('YYYY-MM-DD'),
        participants: values.participants ?? null,
        issueList: values.issueList ?? null,
      }),
    onSuccess: () => {
      message.success('评审结论已录入，课程主状态已随之变更');
      setRecording(null);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="评审轮次由「提交评审」自动建档"
        description="每次提交评审会生成一轮记录，并锁定当时的材料版本。结论录入后该轮只读；结论录错要走下一轮，不是改这一轮。"
      />

      <Table<CourseReview>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={reviews.data ?? []}
        loading={reviews.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有评审记录。提交评审后自动生成第 1 轮' }}
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'forms', label: '评审形式', children: row.reviewForms.join('、') || '—' },
                { key: 'participants', label: '参与人员', children: row.participants ?? '—' },
                { key: 'opinion', label: '评审意见', children: row.reviewOpinion ?? '—' },
                { key: 'issues', label: '问题清单', children: row.issueList ?? '—' },
              ]}
            />
          ),
        }}
        columns={[
          { title: '轮次', dataIndex: 'roundNo', width: 80, render: (round: number) => `第 ${round} 轮` },
          {
            title: '材料版本',
            dataIndex: 'boundVersionNo',
            width: 110,
            render: (versionNo: string | null) => versionNo ?? '—',
          },
          { title: '评审日期', dataIndex: 'reviewDate', width: 120, render: (v: string | null) => v ?? '—' },
          {
            title: '评审结果',
            dataIndex: 'reviewResult',
            width: 200,
            render: (result: string | null) => (result ? <Tag color="blue">{result}</Tag> : <Text type="secondary">待录入</Text>),
          },
          { title: '记录状态', dataIndex: 'recordState', width: 110 },
          { title: '最后修改', dataIndex: 'updatedAt', width: 160, render: formatDateTime },
          {
            title: '操作',
            key: 'actions',
            width: 120,
            align: 'right',
            render: (_, row) =>
              isOperator && row.editable ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setRecording(row);
                    form.resetFields();
                    form.setFieldsValue({ reviewDate: dayjs() });
                  }}
                >
                  录入结论
                </Button>
              ) : null,
          },
        ]}
      />

      <Modal
        open={recording !== null}
        title={`录入第 ${recording?.roundNo ?? ''} 轮评审结论`}
        okText="保存结论"
        cancelText="取消"
        width={680}
        confirmLoading={record.isPending}
        onCancel={() => setRecording(null)}
        onOk={() => void form.validateFields().then((values) => record.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Card size="small">
            <Text type="secondary">
              本轮绑定的材料版本：{recording?.boundVersionNo ?? '—'}。结论保存后课程主状态随之变更，
              这条记录不再可改。
            </Text>
          </Card>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item label="评审形式" name="reviewForms" rules={[{ required: true, message: '请选择评审形式' }]}>
              <Select mode="multiple" options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewForm])} />
            </Form.Item>
            <Form.Item label="评审日期" name="reviewDate" rules={[{ required: true, message: '请选择评审日期' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="参与人员" name="participants" extra="线下参会的评委与列席人员，自由文本">
              <Input maxLength={500} />
            </Form.Item>
            <Form.Item
              label="评审结果"
              name="reviewResult"
              extra="结果由线下评审会给出，平台只记录。「不通过·关闭」会直接把课程推到终态"
              rules={[{ required: true, message: '请选择评审结果' }]}
            >
              <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewResult])} />
            </Form.Item>
            <Form.Item label="评审意见" name="reviewOpinion" rules={[{ required: true, message: '请填写评审意见' }]}>
              <Input.TextArea rows={4} maxLength={5000} showCount />
            </Form.Item>
            <Form.Item label="问题清单" name="issueList" extra="需要课程开发人整改的具体问题，一行一条">
              <Input.TextArea rows={4} maxLength={5000} showCount />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
}
