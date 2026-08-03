import { useEffect } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi, type Course, type CourseForm } from '@/shared/api/courses';
import {
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
} from './courseMeta';

/**
 * 课程立项与基本信息编辑（需求 9.3.1）。
 *
 * <p>立项与编辑共用一张表单：可编辑字段完全相同，拆成两个组件必然出现「新建能填、编辑填不了」
 * 的字段差异。
 *
 * <p><b>有效期截止日不在表单里</b>（规则 EX1、EX3）：它由首次发布时间与有效期时长算出。
 * 给运营一个可手填的截止日，等于允许它与有效期时长不一致，而列表上的「30 天内到期」看的是截止日。
 *
 * <p>编辑时必须回传 {@code version}（规则 K1）。共享账号下两名运营同时改同一门课是常态而非偶发，
 * 冲突时后端给 {@code CONCURRENT_MODIFIED}，这里原样展示后端文案——它带着最后修改时间。
 */

interface CourseFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为立项 */
  course?: Course;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
}

interface FormValues extends Omit<CourseForm, 'initiatedDate' | 'expectPublishDate' | 'classHours'> {
  initiatedDate: Dayjs;
  expectPublishDate: Dayjs;
  classHours?: number | null;
}

export function CourseFormModal({ open, course, onClose, onCreated, onUpdated }: CourseFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const dicts = useDicts();
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
        ownerNo: course.ownerNo,
        initiatedDate: dayjs(course.initiatedDate),
        expectPublishDate: dayjs(course.expectPublishDate),
        summary: course.summary,
        targetAudience: course.targetAudience,
        classHours: course.classHours === null ? null : Number(course.classHours),
        categoryCode: course.categoryCode,
        validityPeriod: course.validityPeriod,
        externalLink: course.externalLink,
        qualityMarks: course.qualityMarks,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ initiatedDate: dayjs() });
    }
  }, [open, course, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CourseForm = {
        ...values,
        initiatedDate: values.initiatedDate.format('YYYY-MM-DD'),
        expectPublishDate: values.expectPublishDate.format('YYYY-MM-DD'),
        classHours: values.classHours === null || values.classHours === undefined
          ? null
          : String(values.classHours),
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

  return (
    <Modal
      open={open}
      title={course ? `编辑课程 ${course.courseNo}` : '课程立项'}
      okText="保存"
      cancelText="取消"
      width={720}
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() => {
        void form.validateFields().then((values) => save.mutateAsync(values));
      }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="课程名称" name="courseName" rules={[{ required: true, message: '请填写课程名称' }]}>
          <Input maxLength={100} showCount />
        </Form.Item>
        <Form.Item
          label="评审轨道"
          name="reviewTrack"
          extra="由线下评审会判定后录入，允许中途修改。它决定试讲的验收标准取哪一组"
          rules={[{ required: true, message: '请选择评审轨道' }]}
        >
          <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.reviewTrack])} />
        </Form.Item>
        <Form.Item label="所属领域" name="domainCode" rules={[{ required: true, message: '请选择所属领域' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={(dicts.data?.[DICT_KEYS.combatUnit] ?? []).map((item) => ({
              value: item.code,
              label: item.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="课程负责人"
          name="ownerNo"
          extra="负责人只是台账信息，不影响谁能编辑这门课——运营账号可以编辑任何课程"
          rules={[{ required: true, message: '请选择课程负责人' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={(employees.data?.records ?? []).map((item) => ({
              value: item.employeeNo,
              // 人员状态直接显示出来：离职的人照样可选（历史课程要能编辑），由运营自己判断
              label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
            }))}
          />
        </Form.Item>
        <Form.Item label="立项时间" name="initiatedDate" rules={[{ required: true, message: '请填写立项时间' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="预计发布时间"
          name="expectPublishDate"
          extra="三色灯按它判定「即将到期」与「已逾期」，填得越准，预警越有用"
          rules={[{ required: true, message: '请填写预计发布时间' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="课程有效期"
          name="validityPeriod"
          extra="从首次发布之日起算。过期只在列表上打标签，不改变课程状态、不阻断排课"
          rules={[{ required: true, message: '请选择课程有效期' }]}
        >
          <Select options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.validityPeriod])} />
        </Form.Item>
        <Form.Item label="课程分类" name="categoryCode">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={(dicts.data?.[DICT_KEYS.courseCategory] ?? []).map((item) => ({
              value: item.code,
              label: item.name,
            }))}
          />
        </Form.Item>
        <Form.Item label="课时" name="classHours">
          <InputNumber min={0} max={999} step={0.5} style={{ width: '100%' }} addonAfter="学时" />
        </Form.Item>
        <Form.Item label="面向人群" name="targetAudience">
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item label="课程简介" name="summary">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>
        <Form.Item
          label="课程外部链接"
          name="externalLink"
          extra="视频一律填外部链接，不上传到平台"
          rules={[{ pattern: /^$|^https?:\/\/.+/, message: '需以 http:// 或 https:// 开头' }]}
        >
          <Input maxLength={500} placeholder="https://" />
        </Form.Item>
        <Form.Item label="精品标注" name="qualityMarks" extra="由线下评审决定后标注，可多选">
          <Select mode="multiple" options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.qualityMark])} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
