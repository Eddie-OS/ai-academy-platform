import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type Course } from '@/shared/api/courses';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { invalidateCourseListAndMetrics } from './courseFilters';
import { COURSE_STATE_FIELDS, DICT_KEYS, useDicts } from './courseMeta';
import { CoursePhaseActions } from './CoursePhaseActions';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';

const COURSE_OWNER_TYPE = 'COURSE';
const INITIATION_REF = 'initiation_files';
const ATTACHMENT_ACCEPT = '.doc,.docx,.ppt,.pptx,.xls,.xlsx';

interface CourseInitiateTabProps {
  course: Course;
}

interface FormValues {
  businessPain?: string;
  courseGoal?: string;
  courseValue?: string;
  targetAudience?: string;
  outlineSummary?: string;
  estimateDevDays?: number | null;
  reviewJudges?: string;
  initiationReviewDate?: Dayjs | null;
  initiationReviewConclusion?: string;
  initiationReviewOpinion?: string;
  initiationStatus?: string;
}

/**
 * 课程详情「立项」页。字段按规格 13 项；主状态动作仍走状态机，立项状态本身是字典手选。
 */
export function CourseInitiateTab({ course }: CourseInitiateTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const dicts = useDicts();
  const [form] = Form.useForm<FormValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);

  const fill = () => {
    form.setFieldsValue({
      businessPain: course.businessPain ?? '',
      courseGoal: course.courseGoal ?? '',
      courseValue: course.courseValue ?? '',
      targetAudience: course.targetAudience ?? '',
      outlineSummary: course.outlineSummary ?? '',
      estimateDevDays:
        course.estimateDevDays === null || course.estimateDevDays === undefined
          ? undefined
          : Number(course.estimateDevDays),
      reviewJudges: course.reviewJudges ?? '',
      initiationReviewDate: course.initiationReviewDate ? dayjs(course.initiationReviewDate) : null,
      initiationReviewConclusion: course.initiationReviewConclusion ?? undefined,
      initiationReviewOpinion: course.initiationReviewOpinion ?? '',
      initiationStatus: course.initiationStatus ?? undefined,
    });
  };

  useEffect(fill, [course, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      courseApi.saveInitiation(course.id, {
        businessPain: values.businessPain || null,
        courseGoal: values.courseGoal || null,
        courseValue: values.courseValue || null,
        targetAudience: values.targetAudience || null,
        outlineSummary: values.outlineSummary || null,
        estimateDevDays:
          values.estimateDevDays === null || values.estimateDevDays === undefined
            ? null
            : String(values.estimateDevDays),
        reviewJudges: values.reviewJudges || null,
        initiationReviewDate: values.initiationReviewDate
          ? values.initiationReviewDate.format('YYYY-MM-DD')
          : null,
        initiationReviewConclusion: values.initiationReviewConclusion || null,
        initiationReviewOpinion: values.initiationReviewOpinion || null,
        initiationStatus: values.initiationStatus || null,
        version: course.version,
      }),
    onSuccess: () => {
      message.success('立项信息已保存');
      setEditing(false);
      invalidateCourseListAndMetrics(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const statusOptions = (dicts.data?.[DICT_KEYS.courseInitiationStatus] ?? []).map((item) => ({
    value: item.code,
    label: item.name,
  }));
  const conclusionOptions = (dicts.data?.[DICT_KEYS.courseInitiationReviewConclusion] ?? []).map(
    (item) => ({
      value: item.code,
      label: item.name,
    }),
  );

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <CoursePhaseActions
        course={course}
        stateField={COURSE_STATE_FIELDS.main}
        extraMainActions={['START_DEVELOP']}
        includeClose
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
            onSave={() => form.submit()}
          />
        </div>
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={!isOperator || !editing}
        onFinish={(values) => void save.mutateAsync(values)}
      >
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="立项单号" extra="用于区分立项，由系统按 LI + 年月 + 流水生成">
              <Input value={course.initiationNo ?? '保存课程后自动生成'} disabled />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="业务背景与痛点"
              name="businessPain"
              extra="课程为什么要做、值不值得做"
            >
              <Input.TextArea rows={3} placeholder="请填写业务背景与痛点" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="课程目标"
              name="courseGoal"
              extra="学员学完应掌握的知识或行为"
            >
              <Input.TextArea rows={3} placeholder="请填写课程目标" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="课程价值" name="courseValue" extra="课程 ROI">
              <Input.TextArea rows={3} placeholder="请填写课程价值" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="目标受众"
              name="targetAudience"
              extra="学员角色层级与范围"
            >
              <Input.TextArea rows={3} placeholder="请填写目标受众" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="初步大纲摘要"
              name="outlineSummary"
              extra="简单的课程框架"
            >
              <Input.TextArea rows={3} placeholder="请填写初步大纲摘要" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="预估开发工时"
              name="estimateDevDays"
              extra="评估开发周期，单位天"
            >
              <InputNumber min={0} max={9999} step={0.5} style={{ width: '100%' }} addonAfter="天" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="评审责任人"
              name="reviewJudges"
              extra="评委姓名，可多人"
            >
              <Input.TextArea rows={2} placeholder="请填写评委姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="立项评审时间"
              name="initiationReviewDate"
              extra="评审完成时间"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="立项评审结论"
              name="initiationReviewConclusion"
              extra="通过或不通过"
            >
              <Select allowClear showSearch optionFilterProp="label" options={conclusionOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="立项评审意见"
              name="initiationReviewOpinion"
              extra="综合意见、建议或不通过原因"
            >
              <Input.TextArea rows={3} placeholder="请填写立项评审意见" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="立项状态"
              name="initiationStatus"
              extra="手选记录，不驱动课程主状态"
            >
              <Select allowClear showSearch optionFilterProp="label" options={statusOptions} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="附件"
              extra="支持 Word、PPT、Excel。课件与教案请到「材料与版本」页签"
            >
              <AttachmentField
                ownerType={COURSE_OWNER_TYPE}
                ownerId={course.id}
                refField={INITIATION_REF}
                emptyHint="可上传 Word、PPT、Excel"
                scene={ATTACHMENT_SCENE_GENERAL}
                accept={ATTACHMENT_ACCEPT}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Space>
  );
}
