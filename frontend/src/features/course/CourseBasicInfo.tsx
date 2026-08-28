import { App, Col, DatePicker, Descriptions, Form, Input, InputNumber, Row, Select, Space } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type Course, type CourseForm } from '@/shared/api/courses';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import { invalidateCourseListAndMetrics } from './courseFilters';
import {
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useBusinessDomains,
  useDicts,
  useDomainLabel,
  useEmployees,
  useFieldEnums,
} from './courseMeta';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';

const COURSE_OWNER_TYPE = 'COURSE';
const COURSE_EXTRAS_REF = 'course_files';
const ATTACHMENT_ACCEPT = '.doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx,.zip';

interface FormValues {
  courseName: string;
  domainCode: string;
  categoryCode: string;
  ownerNos: string[];
  summary: string;
  targetAudience: string;
  source: string;
  classHours?: number | null;
  remark?: string | null;
  reviewTrack: string;
  validityPeriod: string;
  initiatedDate: Dayjs;
  expectPublishDate: Dayjs;
  externalLink?: string;
  qualityMarks?: string[];
}

/**
 * 课程详情「基本信息」页签。默认只读；运营点编辑后按立项表单同一套字段保存。
 */
export function CourseBasicInfo({ course }: { course: Course }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const dicts = useDicts();
  const fieldEnums = useFieldEnums();
  const businessDomains = useBusinessDomains();
  const employees = useEmployees();
  const domainLabelOf = useDomainLabel();
  const [form] = Form.useForm<FormValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);

  const domainLabel = domainLabelOf(course.domainCode) ?? course.domainCode;
  const categoryLabel = course.categoryCode
    ? (dicts.data?.[DICT_KEYS.courseCategory]?.find((item) => item.code === course.categoryCode)?.name ??
      course.categoryCode)
    : '—';

  const fill = () => {
    form.setFieldsValue({
      courseName: course.courseName,
      reviewTrack: course.reviewTrack,
      domainCode: course.domainCode,
      ownerNos: course.ownerNo ? [course.ownerNo] : [],
      initiatedDate: dayjs(course.initiatedDate),
      expectPublishDate: dayjs(course.expectPublishDate),
      summary: course.summary ?? '',
      targetAudience: course.targetAudience ?? '',
      classHours: course.classHours === null ? undefined : Number(course.classHours),
      categoryCode: course.categoryCode ?? undefined,
      validityPeriod: course.validityPeriod,
      externalLink: course.externalLink ?? undefined,
      qualityMarks: course.qualityMarks,
      source: course.source ?? '',
      remark: course.remark ?? undefined,
    });
  };

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const ownerNo = values.ownerNos[0];
      if (!ownerNo) {
        throw new Error('请选择至少一名课程负责人');
      }
      const payload: CourseForm = {
        courseName: values.courseName,
        domainCode: values.domainCode,
        categoryCode: values.categoryCode,
        ownerNo,
        summary: values.summary,
        targetAudience: values.targetAudience,
        source: values.source ?? null,
        remark: values.remark ?? null,
        classHours:
          values.classHours === null || values.classHours === undefined ? null : String(values.classHours),
        reviewTrack: values.reviewTrack,
        validityPeriod: values.validityPeriod,
        initiatedDate: values.initiatedDate.format('YYYY-MM-DD'),
        expectPublishDate: values.expectPublishDate.format('YYYY-MM-DD'),
        externalLink: values.externalLink ?? null,
        qualityMarks: values.qualityMarks,
      };
      return courseApi.update(course.id, payload, course.version);
    },
    onSuccess: () => {
      message.success('基本信息已保存');
      setEditing(false);
      invalidateCourseListAndMetrics(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const startEdit = () => {
    fill();
    setEditing(true);
  };

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      {isOperator && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CourseTabEditBar
            editing={editing}
            saving={save.isPending}
            onEdit={startEdit}
            onCancel={() => {
              fill();
              setEditing(false);
            }}
            onSave={() => form.submit()}
          />
        </div>
      )}

      {editing ? (
        <Form form={form} layout="vertical" requiredMark onFinish={(values) => void save.mutateAsync(values)}>
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item label="课程ID" extra="系统生成，不可改">
                <Input value={course.courseNo} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程名称"
                name="courseName"
                rules={[{ required: true, message: '请填写课程名称' }]}
              >
                <Input maxLength={100} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程所属领域"
                name="domainCode"
                rules={[{ required: true, message: '请选择课程所属领域' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={businessDomains.map((domain) => ({ value: domain, label: domain }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程类型"
                name="categoryCode"
                rules={[{ required: true, message: '请选择课程类型' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={(dicts.data?.[DICT_KEYS.courseCategory] ?? []).map((item) => ({
                    value: item.code,
                    label: item.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程负责人"
                name="ownerNos"
                extra="第一位记为台账负责人，不影响谁能编辑"
                rules={[{ required: true, type: 'array', min: 1, message: '请选择至少一名课程负责人' }]}
              >
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  options={(employees.data?.records ?? []).map((item) => ({
                    value: item.employeeNo,
                    label: `${item.employeeName}（${item.employeeNo}·${item.deptName}）`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="预计课时"
                name="classHours"
                rules={[{ required: true, message: '请填写预计课时' }]}
              >
                <InputNumber min={0} max={999} step={0.5} style={{ width: '100%' }} addonAfter="h" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="课程简介"
                name="summary"
                rules={[{ required: true, message: '请填写课程简介' }]}
              >
                <Input.TextArea rows={3} maxLength={2000} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程面向对象"
                name="targetAudience"
                rules={[{ required: true, message: '请填写课程面向对象' }]}
              >
                <Input maxLength={500} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程来源"
                name="source"
                rules={[{ required: true, message: '请填写课程来源' }]}
              >
                <Input maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="评审轨道"
                name="reviewTrack"
                extra="决定试讲验收标准取哪一组"
                rules={[{ required: true, message: '请选择评审轨道' }]}
              >
                <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewTrack])} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="课程有效期"
                name="validityPeriod"
                rules={[{ required: true, message: '请选择课程有效期' }]}
              >
                <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.validityPeriod])} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="立项时间"
                name="initiatedDate"
                rules={[{ required: true, message: '请填写立项时间' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="预计发布时间"
                name="expectPublishDate"
                extra="三色灯按它判定即将到期与已逾期"
                rules={[{ required: true, message: '请填写预计发布时间' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="首次发布时间" extra="课程首次进入发布时由系统写入">
                <Input value={course.firstPublishDate ?? '—'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="质量标注" name="qualityMarks" extra="由线下评审决定后标注">
                <Select
                  mode="multiple"
                  allowClear
                  options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.qualityMark])}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="外部链接"
                name="externalLink"
                rules={[{ pattern: /^$|^https?:\/\/.+/, message: '需以 http:// 或 https:// 开头' }]}
              >
                <Input maxLength={500} placeholder="https://" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="附件" extra="课件、教案请到「材料与版本」页签管理">
                <AttachmentField
                  ownerType={COURSE_OWNER_TYPE}
                  ownerId={course.id}
                  refField={COURSE_EXTRAS_REF}
                  emptyHint="可上传 Word、PPT、PDF 等补充材料"
                  scene={ATTACHMENT_SCENE_GENERAL}
                  accept={ATTACHMENT_ACCEPT}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} maxLength={2000} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ) : (
        <Descriptions
          column={1}
          size="small"
          styles={{ label: { color: neutral[600], width: 116, fontSize: fontSize.bodySm } }}
          items={[
            { key: 'no', label: '课程ID', children: course.courseNo },
            { key: 'name', label: '课程名称', children: course.courseName },
            { key: 'domain', label: '领域', children: domainLabel },
            { key: 'category', label: '课程类型', children: categoryLabel },
            { key: 'owner', label: '负责人', children: course.ownerName ?? course.ownerNo },
            { key: 'source', label: '来源', children: course.source ?? '—' },
            { key: 'hours', label: '预计课时', children: course.classHours ? `${course.classHours} 学时` : '—' },
            { key: 'audience', label: '面向人群', children: course.targetAudience ?? '—' },
            { key: 'summary', label: '简介', children: course.summary ?? '—' },
            { key: 'remark', label: '备注', children: course.remark ?? '—' },
            { key: 'track', label: '评审轨道', children: course.reviewTrack },
            { key: 'initiated', label: '立项时间', children: course.initiatedDate },
            { key: 'expect', label: '预计发布时间', children: course.expectPublishDate },
            { key: 'firstPublish', label: '首次发布时间', children: course.firstPublishDate ?? '—' },
            { key: 'validity', label: '课程有效期', children: course.validityPeriod },
          ]}
        />
      )}
    </Space>
  );
}
