import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Form, Input, Modal, Radio, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type Course, type CourseReview } from '@/shared/api/courses';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { COURSE_STATE_FIELDS, DICT_KEYS, FIELD_ENUM_KEYS, selectOptions, useDicts, useEmployees, useFieldEnums } from './courseMeta';
import { invalidateCourseListAndMetrics } from './courseFilters';
import { CoursePhaseActions } from './CoursePhaseActions';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';
import { formatDateTime } from './CourseMaterialsTab';

const { Text } = Typography;

const COURSE_OWNER_TYPE = 'COURSE';
const PRELIM_REF = 'review_prelim_files';
const MEETING_REF = 'review_meeting_files';
const ATTACHMENT_ACCEPT = '.doc,.docx,.ppt,.pptx,.xls,.xlsx';

interface CourseReviewsTabProps {
  course: Course;
}

interface LedgerValues {
  ownerNo?: string;
  reviewRoundLabel?: string;
  reviewCompletedDate?: Dayjs | null;
  reviewLedgerPhase?: string;
  reviewLedgerStatus?: string;
  enterTrial?: string;
  prelimRoundLabel?: string;
  prelimReviewers?: string;
  prelimReviewDate?: Dayjs | null;
  prelimCompletedDate?: Dayjs | null;
  prelimConclusion?: string;
  prelimOpinion?: string;
  enterMeeting?: string;
  meetingRoundLabel?: string;
  meetingReviewers?: string;
  meetingActualDate?: Dayjs | null;
  meetingConclusion?: string;
  meetingOpinion?: string;
}

interface ConclusionValues {
  reviewForms: string[];
  reviewDate: Dayjs;
  participants?: string;
  reviewResult: string;
  reviewOpinion: string;
  issueList?: string;
}

/**
 * 详情页「评审」页签。上面是规格台账（基础信息 + 初步评审 + 上会评审），下面是官方评审记录。
 *
 * <p>评审记录不能手工新建。每一轮由「提交评审」副作用创建，并锁定当时的材料版本（规则 R7）。
 * 结论录入后该轮只读；录错走下一轮。
 *
 * <p>「是否进入试讲」只留痕。正式进入试讲仍须在下方录入结论＝通过，不能在保存台账时直接
 * 走 REVIEW_PASS，否则会留下没有结论的记录。
 */
export function CourseReviewsTab({ course }: CourseReviewsTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const dicts = useDicts();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();
  const [ledgerForm] = Form.useForm<LedgerValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);
  const [recording, setRecording] = useState<CourseReview | null>(null);
  const [conclusionForm] = Form.useForm<ConclusionValues>();

  const reviews = useQuery({
    queryKey: ['courses', course.id, 'reviews'],
    queryFn: () => courseApi.reviews(course.id),
  });

  const fill = () => {
    ledgerForm.setFieldsValue({
      ownerNo: course.ownerNo || undefined,
      reviewRoundLabel: course.reviewRoundLabel ?? undefined,
      reviewCompletedDate: course.reviewCompletedDate ? dayjs(course.reviewCompletedDate) : null,
      reviewLedgerPhase: course.reviewLedgerPhase ?? undefined,
      reviewLedgerStatus: course.reviewLedgerStatus ?? undefined,
      enterTrial: course.enterTrial ?? undefined,
      prelimRoundLabel: course.prelimRoundLabel ?? undefined,
      prelimReviewers: course.prelimReviewers ?? undefined,
      prelimReviewDate: course.prelimReviewDate ? dayjs(course.prelimReviewDate) : null,
      prelimCompletedDate: course.prelimCompletedDate ? dayjs(course.prelimCompletedDate) : null,
      prelimConclusion: course.prelimConclusion ?? undefined,
      prelimOpinion: course.prelimOpinion ?? undefined,
      enterMeeting: course.enterMeeting ?? undefined,
      meetingRoundLabel: course.meetingRoundLabel ?? undefined,
      meetingReviewers: course.meetingReviewers ?? undefined,
      meetingActualDate: course.meetingActualDate ? dayjs(course.meetingActualDate) : null,
      meetingConclusion: course.meetingConclusion ?? undefined,
      meetingOpinion: course.meetingOpinion ?? undefined,
    });
  };

  useEffect(fill, [course, ledgerForm]);

  const save = useMutation({
    mutationFn: (values: LedgerValues) =>
      courseApi.saveReviewLedger(course.id, {
        ownerNo: values.ownerNo || null,
        reviewRoundLabel: values.reviewRoundLabel || null,
        reviewCompletedDate: values.reviewCompletedDate
          ? values.reviewCompletedDate.format('YYYY-MM-DD')
          : null,
        reviewLedgerPhase: values.reviewLedgerPhase || null,
        reviewLedgerStatus: values.reviewLedgerStatus || null,
        enterTrial: values.enterTrial || null,
        prelimRoundLabel: values.prelimRoundLabel || null,
        prelimReviewers: values.prelimReviewers || null,
        prelimReviewDate: values.prelimReviewDate
          ? values.prelimReviewDate.format('YYYY-MM-DD')
          : null,
        prelimCompletedDate: values.prelimCompletedDate
          ? values.prelimCompletedDate.format('YYYY-MM-DD')
          : null,
        prelimConclusion: values.prelimConclusion || null,
        prelimOpinion: values.prelimOpinion || null,
        enterMeeting: values.enterMeeting || null,
        meetingRoundLabel: values.meetingRoundLabel || null,
        meetingReviewers: values.meetingReviewers || null,
        meetingActualDate: values.meetingActualDate
          ? values.meetingActualDate.format('YYYY-MM-DD')
          : null,
        meetingConclusion: values.meetingConclusion || null,
        meetingOpinion: values.meetingOpinion || null,
        version: course.version,
      }),
    onSuccess: () => {
      message.success('评审信息已保存');
      setEditing(false);
      invalidateCourseListAndMetrics(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
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
      conclusionForm.resetFields();
      invalidateCourseListAndMetrics(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  const phaseOptions = (dicts.data?.[DICT_KEYS.courseReviewPhase] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const statusOptions = (dicts.data?.[DICT_KEYS.courseReviewLedgerStatus] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const prelimConclusionOptions = (dicts.data?.[DICT_KEYS.prelimReviewConclusion] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const meetingConclusionOptions = (dicts.data?.[DICT_KEYS.meetingConclusion] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const roundOptions = (fieldEnums.data?.[FIELD_ENUM_KEYS.reviewRound] ?? []).map((value) => ({
    value,
    label: value,
  }));
  const enterTrial = fieldEnums.data?.[FIELD_ENUM_KEYS.enterTrial] ?? [];
  const enterMeeting = fieldEnums.data?.[FIELD_ENUM_KEYS.enterMeeting] ?? [];
  const ownerOptions = (employees.data?.records ?? []).map((item) => ({
    value: item.employeeNo,
    label: `${item.employeeName}（${item.employeeNo}）`,
  }));

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <CoursePhaseActions
        course={course}
        stateField={COURSE_STATE_FIELDS.main}
        extraMainActions={['SUBMIT_REVIEW', 'RESUBMIT_REVIEW']}
      />

      {isOperator && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CourseTabEditBar
            editing={editing}
            saving={save.isPending}
            onEdit={() => {
              fill();
              setEditing(true);
            }}
            onCancel={() => {
              fill();
              setEditing(false);
            }}
            onSave={() => ledgerForm.submit()}
          />
        </div>
      )}

      <Form
        form={ledgerForm}
        layout="vertical"
        disabled={!isOperator || !editing}
        onFinish={(values) => void save.mutateAsync(values)}
      >
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          一、评审基础信息
        </Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="关联课程ID" extra="与课程基本信息联动，不可改">
              <Input value={course.courseNo} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="关联立项单号" extra="与立项页同一单号">
              <Input value={course.initiationNo ?? ''} disabled placeholder="—" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="课程名称">
              <Input value={course.courseName} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="课程负责人" name="ownerNo" extra="课程开发负责人">
              <Select showSearch allowClear optionFilterProp="label" options={ownerOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="评审轮数" name="reviewRoundLabel" extra="手选台账，与下方自动建档轮次分开">
              <Select allowClear showSearch optionFilterProp="label" options={roundOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="评审完成时间" name="reviewCompletedDate">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="当前评审阶段"
              name="reviewLedgerPhase"
              extra="手选记录，不驱动课程主状态"
            >
              <Select allowClear showSearch optionFilterProp="label" options={phaseOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="评审状态"
              name="reviewLedgerStatus"
              extra="看板台账状态，不是官方评审记录状态"
            >
              <Select allowClear showSearch optionFilterProp="label" options={statusOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="是否进入试讲环节"
              name="enterTrial"
              extra="选「是」只留痕；正式进入试讲仍须在下方录入本轮结论＝通过"
            >
              <Radio.Group>
                {enterTrial.map((value) => (
                  <Radio key={value} value={value}>
                    {value}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>二、初步评审</Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="初步评审轮数" name="prelimRoundLabel">
              <Select allowClear showSearch optionFilterProp="label" options={roundOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="初步评审人员" name="prelimReviewers">
              <Input maxLength={500} placeholder="评委姓名，可用顿号分隔" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="初步评审时间" name="prelimReviewDate">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="初步评审完成时间"
              name="prelimCompletedDate"
              extra="结论与反馈闭环截止日"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="初步评审结论" name="prelimConclusion">
              <Select allowClear showSearch optionFilterProp="label" options={prelimConclusionOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="是否进入上会评审环节"
              name="enterMeeting"
              extra="一期无上会状态机，选「是」只留痕"
            >
              <Select
                allowClear
                options={enterMeeting.map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="初步评审意见"
              name="prelimOpinion"
              extra="覆盖漏洞、逻辑、合规、优化建议与具体修改要求"
            >
              <Input.TextArea rows={4} maxLength={5000} showCount />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="附件" extra="支持 Word、PPT、Excel">
              <AttachmentField
                ownerType={COURSE_OWNER_TYPE}
                ownerId={course.id}
                refField={PRELIM_REF}
                emptyHint="可上传 Word、PPT、Excel"
                scene={ATTACHMENT_SCENE_GENERAL}
                accept={ATTACHMENT_ACCEPT}
              />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>三、上会评审</Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="上会评审轮数" name="meetingRoundLabel">
              <Select allowClear showSearch optionFilterProp="label" options={roundOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="上会评审人员" name="meetingReviewers">
              <Input maxLength={500} placeholder="评委姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="实际上会时间"
              name="meetingActualDate"
              extra="最终课程评审会实际完成时间"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="上会最终结论"
              name="meetingConclusion"
              extra="手选台账，不驱动课程主状态；正式流转仍须在下方录入结论"
            >
              <Select allowClear showSearch optionFilterProp="label" options={meetingConclusionOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="上会评审意见" name="meetingOpinion" extra="顶层指导意见">
              <Input.TextArea rows={4} maxLength={5000} showCount />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="附件" extra="支持 Word、PPT、Excel">
              <AttachmentField
                ownerType={COURSE_OWNER_TYPE}
                ownerId={course.id}
                refField={MEETING_REF}
                emptyHint="可上传 Word、PPT、Excel"
                scene={ATTACHMENT_SCENE_GENERAL}
                accept={ATTACHMENT_ACCEPT}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Typography.Title level={5} style={{ marginBottom: 0 }}>
        四、评审记录
      </Typography.Title>
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
            render: (result: string | null) =>
              result ? <Tag color="blue">{result}</Tag> : <Text type="secondary">待录入</Text>,
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
                    conclusionForm.setFieldsValue({ reviewDate: dayjs() });
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
        onOk={() => void conclusionForm.validateFields().then((values) => record.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Card size="small">
            <Text type="secondary">
              本轮绑定的材料版本：{recording?.boundVersionNo ?? '—'}。结论保存后课程主状态随之变更，
              这条记录不再可改。
            </Text>
          </Card>
          <Form form={conclusionForm} layout="vertical" requiredMark={false}>
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
