import { useEffect } from 'react';
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type Course, type CourseForm } from '@/shared/api/courses';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import {
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useBusinessDomains,
  useDicts,
  useEmployees,
  useFieldEnums,
} from './courseMeta';
import '@/shared/theme/form-modal-v2.css';
import './courseFormModal.css';

const ATTACHMENT_ACCEPT = '.doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx,.zip';
const COURSE_OWNER_TYPE = 'COURSE';
const COURSE_EXTRAS_REF = 'course_files';

/**
 * 课程立项与基本信息编辑。
 *
 * <p>新建按「由课程负责人填写」那 11 项：课程ID（系统生成）、名称、所属领域、类型、
 * 负责人（可多人）、简介、面向对象、来源、预计课时、附件、备注。
 *
 * <p>评审轨道、立项时间、预计发布、有效期仍要提交（三色灯与试讲验收标准依赖它们）。
 * 新建时用枚举首项与当天／+30 天默认值，不摊在负责人填写的那一屏里。
 *
 * <p>有效期截止日不在表单里（EX1、EX3）。编辑必须回传 {@code version}（K1）。
 */

interface CourseFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为立项 */
  course?: Course;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

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
  reviewTrack?: string;
  validityPeriod?: string;
  initiatedDate?: Dayjs;
  expectPublishDate?: Dayjs;
  externalLink?: string;
  qualityMarks?: string[];
}

export function CourseFormModal({ open, course, onClose, onCreated, onUpdated, onDeleted }: CourseFormModalProps) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const dicts = useDicts();
  const businessDomains = useBusinessDomains();
  const employees = useEmployees();

  useEffect(() => {
    if (!open) {
      return;
    }
    if (course) {
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
    } else {
      form.resetFields();
      form.setFieldsValue({ ownerNos: [] });
    }
  }, [open, course, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const tracks = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewTrack]);
      const periods = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.validityPeriod]);
      const ownerNo = values.ownerNos[0];
      if (!ownerNo) {
        throw new Error('请选择至少一名课程负责人');
      }
      // 两个枚举缺省取下发列表的首项，而列表在 /api/meta 回来之前是空的。
      // 在装 payload 之前判空，装完再判类型上仍是 string | undefined
      const reviewTrack = values.reviewTrack ?? tracks[0]?.value;
      const validityPeriod = values.validityPeriod ?? periods[0]?.value;
      if (!reviewTrack || !validityPeriod) {
        throw new Error('课程枚举尚未加载完成，请稍后重试');
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
        reviewTrack,
        validityPeriod,
        initiatedDate: (values.initiatedDate ?? dayjs()).format('YYYY-MM-DD'),
        expectPublishDate: (values.expectPublishDate ?? dayjs().add(30, 'day')).format('YYYY-MM-DD'),
        externalLink: values.externalLink ?? null,
        qualityMarks: values.qualityMarks,
      };
      return course
        ? courseApi.update(course.id, payload, course.version).then(() => course.id)
        : courseApi.initiate(payload);
    },
    onSuccess: (id) => {
      message.success(course ? '课程信息已保存' : '课程已创建');
      if (course) {
        onUpdated?.();
      } else {
        onCreated?.(id);
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const remove = useMutation({
    mutationFn: () => courseApi.remove(course!.id),
    onSuccess: () => {
      message.success('课程已删除');
      onDeleted?.();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  return (
    <Modal
      open={open}
      title={course ? `编辑课程 ${course.courseNo}` : '新建课程'}
      width={1100}
      centered
      zIndex={1200}
      className="course-form-modal crs-form-modal"
      rootClassName="crs-form-modal-root"
      destroyOnHidden
      onCancel={onClose}
      footer={
        <>
          {course ? (
            <Button
              className="crs-form-modal-delete"
              danger
              disabled={save.isPending}
              loading={remove.isPending}
              onClick={() =>
                modal.confirm({
                  title: `删除课程「${course.courseNo}」？`,
                  content: '删除后课程工作台不再显示这门课。已发生的培训与案例不会被删。',
                  okText: '删除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () => remove.mutateAsync(),
                })
              }
            >
              删除
            </Button>
          ) : null}
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={save.isPending}
            disabled={remove.isPending}
            onClick={() => {
              void form.validateFields().then((values) => save.mutateAsync(values));
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <Form form={form} layout="vertical" requiredMark>
        {!course && <p className="course-form-lead">由课程负责人填写。</p>}
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="课程ID" extra="唯一标识，保存后由系统按 KC + 年月 + 流水自动生成">
              <Input value={course?.courseNo ?? '保存后自动生成'} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="课程名称"
              name="courseName"
              rules={[{ required: true, message: '请填写课程名称' }]}
            >
              <Input maxLength={100} showCount placeholder="请简要概括课程名称" />
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
                placeholder="请选择课程所属领域"
                options={businessDomains.map((domain) => ({
                  value: domain,
                  label: domain,
                }))}
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
                placeholder="请选择课程类型"
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
              extra="支持多人；第一位记为台账负责人，不影响谁能编辑这门课"
              rules={[{ required: true, type: 'array', min: 1, message: '请选择至少一名课程负责人' }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="请选择课程负责人，可多选"
                options={(employees.data?.records ?? []).map((item) => ({
                  value: item.employeeNo,
                  label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="预计课时"
              name="classHours"
              extra="单位小时，例如 1.5"
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
              <Input.TextArea rows={3} maxLength={2000} showCount placeholder="请填写课程内容简介" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="课程面向对象"
              name="targetAudience"
              extra="明确受众，如全员、质量运营、二级部门"
              rules={[{ required: true, message: '请填写课程面向对象' }]}
            >
              <Input maxLength={500} placeholder="请明确课程面向对象" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="课程来源"
              name="source"
              extra="如 AI需求、他人推荐、其他"
              rules={[{ required: true, message: '请填写课程来源' }]}
            >
              <Input maxLength={200} placeholder="请输入课程来源" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="附件上传"
              extra={
                course
                  ? 'Word、PPT 等补充材料。课件、教案请到详情「材料与版本」页签管理。'
                  : 'Word、PPT 等补充材料。请先保存课程，再回来上传。'
              }
            >
              {course ? (
                <AttachmentField
                  ownerType={COURSE_OWNER_TYPE}
                  ownerId={course.id}
                  refField={COURSE_EXTRAS_REF}
                  emptyHint="可上传 Word、PPT、PDF 等补充材料"
                  scene={ATTACHMENT_SCENE_GENERAL}
                  accept={ATTACHMENT_ACCEPT}
                />
              ) : (
                <Input disabled placeholder="保存后再上传 Word、PPT 等补充材料" />
              )}
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="备注" name="remark" extra="非结构化但重要的补充信息">
              <Input.TextArea rows={3} maxLength={2000} showCount placeholder="选填" />
            </Form.Item>
          </Col>
          {course && (
            <>
              <Col span={12}>
                <Form.Item
                  label="评审轨道"
                  name="reviewTrack"
                  extra="决定试讲验收标准取哪一组，允许中途修改"
                  rules={[{ required: true, message: '请选择评审轨道' }]}
                >
                  <Select
                    placeholder="请选择评审轨道"
                    options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewTrack])}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="课程有效期"
                  name="validityPeriod"
                  extra="从首次发布之日起算。过期只打标签，不改主状态、不阻断排课"
                  rules={[{ required: true, message: '请选择课程有效期' }]}
                >
                  <Select
                    placeholder="请选择课程有效期"
                    options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.validityPeriod])}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="立项时间"
                  name="initiatedDate"
                  extra="课程开发周期的起点"
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
              <Col span={24}>
                <Form.Item
                  label="质量标注"
                  name="qualityMarks"
                  extra="由线下评审决定后标注，可多选"
                >
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="请选择质量标注"
                    options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.qualityMark])}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  label="外部链接"
                  name="externalLink"
                  extra="视频或已有材料的外部地址"
                  rules={[{ pattern: /^$|^https?:\/\/.+/, message: '需以 http:// 或 https:// 开头' }]}
                >
                  <Input maxLength={500} placeholder="https://" />
                </Form.Item>
              </Col>
            </>
          )}
        </Row>
      </Form>
    </Modal>
  );
}
