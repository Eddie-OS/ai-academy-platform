import { useState } from 'react';
import { Alert, App, Button, Checkbox, DatePicker, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type CourseTrial } from '@/shared/api/courses';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './courseMeta';
import { formatDateTime } from './CourseMaterialsTab';

const { Text } = Typography;

/**
 * 详情页「试讲记录」页签（需求 9.7）。
 *
 * <p><b>两个结论各取一次，互不影响</b>（需求 9.7.1 第 8／9 项）：课程结论决定课程主状态，
 * 讲师结论决定这名讲师的试讲合格标记。两者不一致是<b>正常情况</b>——课程本身没问题、
 * 这次讲的人没讲好，或者反过来。界面把不一致标出来供人看，但不阻断保存、不触发任何自动动作。
 *
 * <p>验收标准按评审轨道动态取（需求 9.7.2），且<b>不校验「必须全部勾选才能判合格」</b>：
 * 结论由线下验收会给出，平台只录入。
 */

interface CourseTrialsTabProps {
  courseId: number;
}

interface RoundValues {
  trialDate: Dayjs;
  lecturerId: number;
  participants?: string;
}

interface ConclusionValues {
  acceptanceChecks?: string[];
  courseConclusion: string;
  lecturerConclusion: string;
  expertOpinion: string;
  issueList?: string;
}

export function CourseTrialsTab({ courseId }: CourseTrialsTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState<CourseTrial | null>(null);
  const [roundForm] = Form.useForm<RoundValues>();
  const [conclusionForm] = Form.useForm<ConclusionValues>();

  const trials = useQuery({
    queryKey: ['courses', courseId, 'trials'],
    queryFn: () => courseApi.trials(courseId),
  });
  const lecturers = useQuery({
    queryKey: ['lecturer-options'],
    queryFn: () => courseApi.lecturerOptions(),
  });
  const acceptanceChecks = useQuery({
    queryKey: ['courses', courseId, 'acceptance-checks'],
    queryFn: () => courseApi.acceptanceChecks(courseId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const createRound = useMutation({
    mutationFn: (values: RoundValues) =>
      courseApi.createTrial(courseId, {
        trialDate: values.trialDate.format('YYYY-MM-DD'),
        lecturerId: values.lecturerId,
        participants: values.participants ?? null,
      }),
    onSuccess: () => {
      message.success('试讲记录已建档，结论可稍后录入');
      setCreating(false);
      roundForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '建档失败，请重试'),
  });

  const recordConclusion = useMutation({
    mutationFn: (values: ConclusionValues) =>
      courseApi.recordTrialConclusion(recording!.id, {
        acceptanceChecks: values.acceptanceChecks ?? [],
        courseConclusion: values.courseConclusion,
        lecturerConclusion: values.lecturerConclusion,
        expertOpinion: values.expertOpinion,
        issueList: values.issueList ?? null,
      }),
    onSuccess: () => {
      message.success('试讲结论已录入');
      setRecording(null);
      conclusionForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  const conclusions = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.trialConclusion]);

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="课程结论与讲师结论是两件事"
        description="课程结论决定课程能不能进入发布，讲师结论决定这名讲师是否试讲合格。两者不一致很常见，平台会标出来，但不阻断、也不替你做判断。"
      />

      {isOperator && (
        <div>
          <Button
            type="primary"
            onClick={() => {
              setCreating(true);
              roundForm.resetFields();
              roundForm.setFieldsValue({ trialDate: dayjs() });
            }}
          >
            新增试讲记录
          </Button>
        </div>
      )}

      <Table<CourseTrial>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={trials.data ?? []}
        loading={trials.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有试讲记录' }}
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'checks', label: '验收标准', children: row.acceptanceChecks.join('、') || '—' },
                { key: 'participants', label: '参与验收人员', children: row.participants ?? '—' },
                { key: 'opinion', label: '评审专家意见', children: row.expertOpinion ?? '—' },
                { key: 'issues', label: '问题清单', children: row.issueList ?? '—' },
              ]}
            />
          ),
        }}
        columns={[
          { title: '轮次', dataIndex: 'roundNo', width: 80, render: (round: number) => `第 ${round} 轮` },
          { title: '试讲日期', dataIndex: 'trialDate', width: 120 },
          { title: '试讲讲师', dataIndex: 'lecturerName', width: 120, render: (v: string | null) => v ?? '—' },
          {
            title: '课程结论',
            dataIndex: 'courseConclusion',
            width: 110,
            render: (v: string | null) => (v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">待录入</Text>),
          },
          {
            title: '讲师结论',
            dataIndex: 'lecturerConclusion',
            width: 160,
            render: (v: string | null, row) => (
              <Space size={4}>
                {v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">待录入</Text>}
                {row.inconsistent && <Tag color="warning">与课程结论不一致</Tag>}
              </Space>
            ),
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
                    conclusionForm.resetFields();
                  }}
                >
                  录入结论
                </Button>
              ) : null,
          },
        ]}
      />

      <Modal
        open={creating}
        title="新增试讲记录"
        okText="建档"
        cancelText="取消"
        confirmLoading={createRound.isPending}
        onCancel={() => setCreating(false)}
        onOk={() => void roundForm.validateFields().then((values) => createRound.mutateAsync(values))}
      >
        <Form form={roundForm} layout="vertical" requiredMark={false}>
          <Form.Item label="试讲日期" name="trialDate" rules={[{ required: true, message: '请选择试讲日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="试讲讲师"
            name="lecturerId"
            extra="培养状态不限：试讲往往正是把「培养中」的讲师推向「可上岗」的那一步"
            rules={[{ required: true, message: '请选择试讲讲师' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={lecturers.isLoading}
              options={(lecturers.data ?? []).map((item) => ({
                value: item.id,
                label: `${item.lecturerName}（${item.sourceDept}·${item.trainingState}）`,
              }))}
            />
          </Form.Item>
          <Form.Item label="参与验收人员" name="participants">
            <Input maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={recording !== null}
        title={`录入第 ${recording?.roundNo ?? ''} 轮试讲结论`}
        okText="保存结论"
        cancelText="取消"
        width={680}
        confirmLoading={recordConclusion.isPending}
        onCancel={() => setRecording(null)}
        onOk={() => void conclusionForm.validateFields().then((values) => recordConclusion.mutateAsync(values))}
      >
        <Form form={conclusionForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="验收标准"
            name="acceptanceChecks"
            extra="按评审轨道展示，勾选即记录。不要求勾满才能判合格——结论由线下验收会给出"
          >
            <Checkbox.Group
              options={(acceptanceChecks.data ?? []).map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item
            label="课程试讲结论"
            name="courseConclusion"
            extra="合格后课程进入「发布」，不合格回到「优化」"
            rules={[{ required: true, message: '请录入课程试讲结论' }]}
          >
            <Select options={conclusions} />
          </Form.Item>
          <Form.Item
            label="讲师试讲结论"
            name="lecturerConclusion"
            extra="只影响这名讲师的试讲合格标记，不影响课程状态"
            rules={[{ required: true, message: '请录入讲师试讲结论' }]}
          >
            <Select options={conclusions} />
          </Form.Item>
          <Form.Item label="评审专家意见" name="expertOpinion" rules={[{ required: true, message: '请填写评审专家意见' }]}>
            <Input.TextArea rows={4} maxLength={5000} showCount />
          </Form.Item>
          <Form.Item label="问题清单" name="issueList">
            <Input.TextArea rows={3} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
