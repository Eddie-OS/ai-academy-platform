import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Radio, Row, Select, Space, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { COURSE_OBJECT_TYPE, courseApi, type Course } from '@/shared/api/courses';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { transitionApi } from '@/shared/api/transitions';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { invalidateCourseListAndMetrics } from './courseFilters';
import { COURSE_STATE_FIELDS, DICT_KEYS, useDicts, useEmployees, useFieldEnums } from './courseMeta';
import { CoursePhaseActions } from './CoursePhaseActions';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';

const COURSE_OWNER_TYPE = 'COURSE';
const SELFCHECK_REF = 'selfcheck_files';
const ATTACHMENT_ACCEPT = '.doc,.docx,.ppt,.pptx,.xls,.xlsx';

/** 规格 8 项。文案是表头，取值是／否来自元数据。 */
const SPEC_ITEMS = [
  {
    code: 'GOAL_CLEAR',
    label: '课程目标明确',
    rule: '有清晰学习目标；明确学完后学员能做什么，且可衡量',
  },
  {
    code: 'STRUCTURE',
    label: '结构完整',
    rule: '按五步法：痛点 → 工具介绍 → 演示 → 练习 → 课后任务',
  },
  {
    code: 'KEY_INFO',
    label: '关键信息齐全',
    rule: '基本信息 + 课前准备清单 + 验收标准均已填写',
  },
  {
    code: 'COURSEWARE_SET',
    label: '课件四件套齐全',
    rule: 'PPT + 演示材料／数据 + Prompt 模板 + 任务说明',
  },
  {
    code: 'PPT_STANDARD',
    label: 'PPT规范',
    rule: '15–25 页，含封面／目录／结尾，字体统一、图片清晰',
  },
  {
    code: 'DEMO_REPRO',
    label: '实操演示可复现',
    rule: '每个工具操作有分步截图或录屏，步骤编号，有预期结果',
  },
  {
    code: 'PROMPT_USABLE',
    label: 'Prompt模板可用',
    rule: '核心操作有可复制 Prompt，并说明参数含义',
  },
  {
    code: 'HOMEWORK',
    label: '课后任务设计',
    rule: '任务清晰（做什么／用什么／交什么），课内约 15–20 分钟可完成',
  },
] as const;

interface CourseSelfcheckTabProps {
  course: Course;
}

interface FormValues {
  selfcheckCheckerNo?: string;
  selfcheckCompletedDate?: Dayjs | null;
  selfcheckConclusion?: string;
  selfcheckRecordStatus?: string;
  submitExpertReview?: string;
  specAnswers?: Record<string, string | undefined>;
}

/**
 * 课程详情「自检」页。基础信息按规格 6 项；清单 8 项是／否。
 * 课程自检子状态仍走状态机。选「是」提交专家评审后，若当前能提交评审再走转换。
 */
export function CourseSelfcheckTab({ course }: CourseSelfcheckTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const dicts = useDicts();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();
  const [form] = Form.useForm<FormValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);

  const yesNo = fieldEnums.data?.[FIELD_ENUM_KEYS.meetsRequirement] ?? [];
  const submitYesNo = fieldEnums.data?.[FIELD_ENUM_KEYS.submitExpertReview] ?? [];
  const yes = submitYesNo[0];

  const fill = () => {
    form.setFieldsValue({
      selfcheckCheckerNo: course.selfcheckCheckerNo ?? course.ownerNo ?? undefined,
      selfcheckCompletedDate: course.selfcheckCompletedDate
        ? dayjs(course.selfcheckCompletedDate)
        : null,
      selfcheckConclusion: course.selfcheckConclusion ?? undefined,
      selfcheckRecordStatus: course.selfcheckRecordStatus ?? undefined,
      submitExpertReview: course.submitExpertReview ?? undefined,
      specAnswers: course.selfcheckSpecAnswers ?? {},
    });
  };

  useEffect(fill, [course, form]);

  const availability = useQuery({
    queryKey: ['courses', course.id, 'available'],
    queryFn: () => transitionApi.available(COURSE_OBJECT_TYPE, course.id),
  });
  const mainField = availability.data?.fields.find((item) => item.stateField === COURSE_STATE_FIELDS.main);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      courseApi.saveSelfcheckInfo(course.id, {
        selfcheckCheckerNo: values.selfcheckCheckerNo || null,
        selfcheckCompletedDate: values.selfcheckCompletedDate
          ? values.selfcheckCompletedDate.format('YYYY-MM-DD')
          : null,
        selfcheckConclusion: values.selfcheckConclusion || null,
        selfcheckRecordStatus: values.selfcheckRecordStatus || null,
        submitExpertReview: values.submitExpertReview || null,
        // 下拉清空后 AntD 留下的是 undefined，而接口按「未作答」读 null：
        // 直接透传会让被清空的那一项在 JSON 里整个消失，后端读到的是「没提交这一项」
        specAnswers: Object.fromEntries(
          Object.entries(values.specAnswers ?? {}).map(([code, answer]) => [code, answer ?? null]),
        ),
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

  const refresh = () => invalidateCourseListAndMetrics(queryClient);

  const onFinish = async (values: FormValues) => {
    await save.mutateAsync(values);
    const submit = (mainField?.actions ?? []).find((option) => option.action === 'SUBMIT_REVIEW');
    const canSubmit =
      Boolean(yes) &&
      values.submitExpertReview === yes &&
      submit !== undefined &&
      (mainField?.allowedActions ?? []).includes(submit.label);
    if (canSubmit && submit) {
      const result = await transit.mutateAsync({
        action: submit.action,
        version: course.version + 1,
      });
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setEditing(false);
      refresh();
      return;
    }
    message.success('自检信息已保存');
    setEditing(false);
    refresh();
  };

  const statusOptions = (dicts.data?.[DICT_KEYS.courseSelfcheckRecordStatus] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const conclusionOptions = (dicts.data?.[DICT_KEYS.courseSelfcheckConclusion] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const yesNoOptions = yesNo.map((value) => ({ value, label: value }));

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <CoursePhaseActions
        course={course}
        stateField={COURSE_STATE_FIELDS.selfcheck}
        extraMainActions={['SUBMIT_REVIEW', 'RESUBMIT_REVIEW']}
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
            onSave={() => form.submit()}
          />
        </div>
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={!isOperator || !editing}
        onFinish={(values) => void onFinish(values)}
      >
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          一、自检基础信息
        </Typography.Title>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item
              label="自检人"
              name="selfcheckCheckerNo"
              extra="须为课程负责人本人"
            >
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="请选择自检人"
                options={(employees.data?.records ?? []).map((item) => ({
                  value: item.employeeNo,
                  label: `${item.employeeName}（${item.employeeNo}）`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="自检完成时间"
              name="selfcheckCompletedDate"
              extra="自检完成的日期"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="自检总体结论" name="selfcheckConclusion">
              <Select allowClear showSearch optionFilterProp="label" options={conclusionOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="附件" extra="支持 Word、PPT、Excel">
              <AttachmentField
                ownerType={COURSE_OWNER_TYPE}
                ownerId={course.id}
                refField={SELFCHECK_REF}
                emptyHint="可上传 Word、PPT、Excel"
                scene={ATTACHMENT_SCENE_GENERAL}
                accept={ATTACHMENT_ACCEPT}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="自检状态"
              name="selfcheckRecordStatus"
              extra="手选记录，不驱动课程自检子状态"
            >
              <Select allowClear showSearch optionFilterProp="label" options={statusOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="是否提交专家评审"
              name="submitExpertReview"
              extra="选「是」并保存后，若当前允许则走提交评审"
            >
              <Radio.Group>
                {submitYesNo.map((value) => (
                  <Radio key={value} value={value}>
                    {value}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Typography.Title level={5}>二、自检清单</Typography.Title>
        <Table
          size="small"
          pagination={false}
          rowKey="code"
          dataSource={[...SPEC_ITEMS]}
          columns={[
            { title: '字段', dataIndex: 'label', width: 160 },
            { title: '规则说明', dataIndex: 'rule' },
            {
              title: '是否符合要求',
              dataIndex: 'code',
              width: 160,
              render: (code: string) => (
                <Form.Item name={['specAnswers', code]} style={{ marginBottom: 0 }}>
                  <Select allowClear options={yesNoOptions} placeholder="请选择" />
                </Form.Item>
              ),
            },
          ]}
        />

      </Form>
    </Space>
  );
}
