import { useEffect, useState } from 'react';
import { Alert, App, Button, Checkbox, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { COURSE_OBJECT_TYPE, courseApi, type Course, type CourseTrial } from '@/shared/api/courses';
import { transitionApi } from '@/shared/api/transitions';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { invalidateCourseListAndMetrics } from './courseFilters';
import { COURSE_STATE_FIELDS, DICT_KEYS, FIELD_ENUM_KEYS, selectOptions, useDicts, useEmployees, useFieldEnums } from './courseMeta';
import { CoursePhaseActions } from './CoursePhaseActions';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';
import { formatDateTime } from './CourseMaterialsTab';

const { Text } = Typography;

const COURSE_OWNER_TYPE = 'COURSE';
const COURSEWARE_REF = 'trial_courseware';
const FEEDBACK_REF = 'trial_feedback';
const ATTACHMENT_ACCEPT = '.doc,.docx,.ppt,.pptx,.xls,.xlsx';

interface CourseTrialsTabProps {
  course: Course;
}

interface LedgerValues {
  ownerNo?: string;
  trialLecturerNo?: string;
  trialCurrentPhase?: string;
  trialLedgerStatus?: string;
  trialRoundLabel?: string;
  trialScheduledDate?: Dayjs | null;
  trialAudienceGroup?: string;
  trialAudienceCount?: string;
  trialHours?: number | null;
  trialFormat?: string;
  trialSatisfaction?: string;
  trialOptimizeAdvice?: string;
  trialAcceptanceResult?: string;
  trialReadyToPublish?: string;
  trialLecturerQualified?: string;
  trialConclusionDate?: Dayjs | null;
  trialRemark?: string;
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

/**
 * 详情页「试讲」页签。上面是规格台账（基础信息 + 排期 + 反馈 + 结论），下面是官方试讲记录。
 *
 * <p>「课程是否满足发布要求」选「是」后，仅当当前允许试讲通过时再走状态机（规则 C1）。
 * 「讲师试讲是否合格」只留痕，不改培养状态（规则 TS2）。官方双结论仍走录入结论接口。
 */
export function CourseTrialsTab({ course }: CourseTrialsTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const dicts = useDicts();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();
  const [ledgerForm] = Form.useForm<LedgerValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);
  const [creating, setCreating] = useState(false);
  const [recording, setRecording] = useState<CourseTrial | null>(null);
  const [roundForm] = Form.useForm<RoundValues>();
  const [conclusionForm] = Form.useForm<ConclusionValues>();

  const trials = useQuery({
    queryKey: ['courses', course.id, 'trials'],
    queryFn: () => courseApi.trials(course.id),
  });
  const lecturers = useQuery({
    queryKey: ['lecturer-options'],
    queryFn: () => courseApi.lecturerOptions(),
  });
  const acceptanceChecks = useQuery({
    queryKey: ['courses', course.id, 'acceptance-checks'],
    queryFn: () => courseApi.acceptanceChecks(course.id),
  });
  const availability = useQuery({
    queryKey: ['courses', course.id, 'available'],
    queryFn: () => transitionApi.available(COURSE_OBJECT_TYPE, course.id),
  });

  const fill = () => {
    ledgerForm.setFieldsValue({
      ownerNo: course.ownerNo || undefined,
      trialLecturerNo: course.trialLecturerNo ?? undefined,
      trialCurrentPhase: course.trialCurrentPhase ?? undefined,
      trialLedgerStatus: course.trialLedgerStatus ?? undefined,
      trialRoundLabel: course.trialRoundLabel ?? undefined,
      trialScheduledDate: course.trialScheduledDate ? dayjs(course.trialScheduledDate) : null,
      trialAudienceGroup: course.trialAudienceGroup ?? undefined,
      trialAudienceCount: course.trialAudienceCount ?? undefined,
      trialHours: course.trialHours != null ? Number(course.trialHours) : null,
      trialFormat: course.trialFormat ?? undefined,
      trialSatisfaction: course.trialSatisfaction ?? undefined,
      trialOptimizeAdvice: course.trialOptimizeAdvice ?? undefined,
      trialAcceptanceResult: course.trialAcceptanceResult ?? undefined,
      trialReadyToPublish: course.trialReadyToPublish ?? undefined,
      trialLecturerQualified: course.trialLecturerQualified ?? undefined,
      trialConclusionDate: course.trialConclusionDate ? dayjs(course.trialConclusionDate) : null,
      trialRemark: course.trialRemark ?? undefined,
    });
  };

  useEffect(fill, [course, ledgerForm]);

  const save = useMutation({
    mutationFn: (values: LedgerValues) =>
      courseApi.saveTrialLedger(course.id, {
        ownerNo: values.ownerNo || null,
        trialLecturerNo: values.trialLecturerNo || null,
        trialCurrentPhase: values.trialCurrentPhase || null,
        trialLedgerStatus: values.trialLedgerStatus || null,
        trialRoundLabel: values.trialRoundLabel || null,
        trialScheduledDate: values.trialScheduledDate
          ? values.trialScheduledDate.format('YYYY-MM-DD')
          : null,
        trialAudienceGroup: values.trialAudienceGroup || null,
        trialAudienceCount: values.trialAudienceCount || null,
        trialHours: values.trialHours != null ? String(values.trialHours) : null,
        trialFormat: values.trialFormat || null,
        trialSatisfaction: values.trialSatisfaction || null,
        trialOptimizeAdvice: values.trialOptimizeAdvice || null,
        trialAcceptanceResult: values.trialAcceptanceResult || null,
        trialReadyToPublish: values.trialReadyToPublish || null,
        trialLecturerQualified: values.trialLecturerQualified || null,
        trialConclusionDate: values.trialConclusionDate
          ? values.trialConclusionDate.format('YYYY-MM-DD')
          : null,
        trialRemark: values.trialRemark || null,
        version: course.version,
      }),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const transit = useMutation({
    mutationFn: (payload: { action: string; version: number }) =>
      transitionApi.transit(COURSE_OBJECT_TYPE, course.id, {
        stateField: COURSE_STATE_FIELDS.main,
        action: payload.action,
        version: payload.version,
        remark: null,
      }),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  const createRound = useMutation({
    mutationFn: (values: RoundValues) =>
      courseApi.createTrial(course.id, {
        trialDate: values.trialDate.format('YYYY-MM-DD'),
        lecturerId: values.lecturerId,
        participants: values.participants ?? null,
      }),
    onSuccess: () => {
      message.success('试讲记录已建档，结论可稍后录入');
      setCreating(false);
      roundForm.resetFields();
      invalidateCourseListAndMetrics(queryClient);
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
      invalidateCourseListAndMetrics(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  const mainField = availability.data?.fields.find((item) => item.stateField === COURSE_STATE_FIELDS.main);
  const readyYes = fieldEnums.data?.[FIELD_ENUM_KEYS.trialReadyToPublish]?.[0];

  const onFinish = async (values: LedgerValues) => {
    await save.mutateAsync(values);
    const pass = (mainField?.actions ?? []).find((option) => option.action === 'TRIAL_COURSE_PASS');
    const canPass =
      Boolean(readyYes) &&
      values.trialReadyToPublish === readyYes &&
      pass !== undefined &&
      (mainField?.allowedActions ?? []).includes(pass.label);
    if (canPass && pass) {
      const result = await transit.mutateAsync({
        action: pass.action,
        version: course.version + 1,
      });
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setEditing(false);
      invalidateCourseListAndMetrics(queryClient);
      return;
    }
    message.success('试讲信息已保存');
    setEditing(false);
    invalidateCourseListAndMetrics(queryClient);
  };

  const phaseOptions = (dicts.data?.[DICT_KEYS.courseTrialPhase] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const statusOptions = (dicts.data?.[DICT_KEYS.courseTrialLedgerStatus] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const formatOptions = (dicts.data?.[DICT_KEYS.courseTrialFormat] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const acceptanceOptions = (dicts.data?.[DICT_KEYS.trialAcceptanceResult] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const roundOptions = (fieldEnums.data?.[FIELD_ENUM_KEYS.reviewRound] ?? []).map((value) => ({
    value,
    label: value,
  }));
  const readyOptions = fieldEnums.data?.[FIELD_ENUM_KEYS.trialReadyToPublish] ?? [];
  const qualifiedOptions = fieldEnums.data?.[FIELD_ENUM_KEYS.trialLecturerQualified] ?? [];
  const ownerOptions = (employees.data?.records ?? []).map((item) => ({
    value: item.employeeNo,
    label: `${item.employeeName}（${item.employeeNo}）`,
  }));
  const conclusions = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.trialConclusion]);

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <CoursePhaseActions
        course={course}
        stateField={COURSE_STATE_FIELDS.trial}
        extraMainActions={['TRIAL_COURSE_PASS', 'TRIAL_COURSE_FAIL']}
      />

      {isOperator && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CourseTabEditBar
            editing={editing}
            saving={save.isPending || transit.isPending}
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
        onFinish={(values) => void onFinish(values)}
      >
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          一、试讲基础信息
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
            <Form.Item label="课程负责人" name="ownerNo" extra="课程开发负责人，试讲安排与反馈对接人">
              <Select showSearch allowClear optionFilterProp="label" options={ownerOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="授课讲师" name="trialLecturerNo" extra="本次试讲授课人">
              <Select showSearch allowClear optionFilterProp="label" options={ownerOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="试讲当前阶段"
              name="trialCurrentPhase"
              extra="手选记录，不是试讲子状态"
            >
              <Select allowClear showSearch optionFilterProp="label" options={phaseOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="试讲状态"
              name="trialLedgerStatus"
              extra="看板台账状态，不是试讲子状态"
            >
              <Select allowClear showSearch optionFilterProp="label" options={statusOptions} />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>二、试讲排期</Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="试讲轮数" name="trialRoundLabel" extra="手选台账，与下方自动建档轮次分开">
              <Select allowClear showSearch optionFilterProp="label" options={roundOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="试讲时间" name="trialScheduledDate">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="试讲面向学员群体" name="trialAudienceGroup">
              <Input maxLength={200} placeholder="面向学员所在部门或群体" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="试讲面向学员人数" name="trialAudienceCount">
              <Input maxLength={32} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="试讲时长" name="trialHours">
              <InputNumber min={0} max={999} step={0.5} style={{ width: '100%' }} addonAfter="小时" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="试讲形式" name="trialFormat">
              <Select allowClear showSearch optionFilterProp="label" options={formatOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="试讲课件" extra="通常为 PPT，也支持 Word、Excel">
              <AttachmentField
                ownerType={COURSE_OWNER_TYPE}
                ownerId={course.id}
                refField={COURSEWARE_REF}
                emptyHint="可上传 PPT、Word、Excel"
                scene={ATTACHMENT_SCENE_GENERAL}
                accept={ATTACHMENT_ACCEPT}
              />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>三、试讲反馈</Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={24}>
            <Form.Item label="整体满意度" name="trialSatisfaction" extra="学员对课程的整体满意度">
              <Input.TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="优化建议"
              name="trialOptimizeAdvice"
              extra="逐条记录优化点、整改方向与调整要求"
            >
              <Input.TextArea rows={4} maxLength={5000} showCount />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="反馈附件" extra="问卷等，支持 Word、PPT、Excel">
              <AttachmentField
                ownerType={COURSE_OWNER_TYPE}
                ownerId={course.id}
                refField={FEEDBACK_REF}
                emptyHint="可上传问卷、PPT、Excel、Word"
                scene={ATTACHMENT_SCENE_GENERAL}
                accept={ATTACHMENT_ACCEPT}
              />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>四、试讲结论</Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item
              label="试讲验收结果"
              name="trialAcceptanceResult"
              extra="手选台账，不是官方试讲结论"
            >
              <Select allowClear showSearch optionFilterProp="label" options={acceptanceOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="试讲结论录入时间" name="trialConclusionDate">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="课程是否满足发布要求"
              name="trialReadyToPublish"
              extra="选「是」后，若当前允许试讲通过再走状态机；否则只留痕"
            >
              <Radio.Group>
                {readyOptions.map((value) => (
                  <Radio key={value} value={value}>
                    {value}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="讲师试讲是否合格"
              name="trialLecturerQualified"
              extra="只留痕，不改讲师培养状态"
            >
              <Radio.Group>
                {qualifiedOptions.map((value) => (
                  <Radio key={value} value={value}>
                    {value}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="备注" name="trialRemark" extra="特殊情况、后续上线注意事项等">
              <Input.TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
          </Col>
        </Row>

      </Form>

      <Typography.Title level={5} style={{ marginBottom: 0 }}>
        五、试讲记录
      </Typography.Title>
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
