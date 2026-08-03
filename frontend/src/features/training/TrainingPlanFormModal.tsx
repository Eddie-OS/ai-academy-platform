import { useEffect, useState } from 'react';
import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi } from '@/shared/api/courses';
import { trainingApi, type TrainingPlan, type TrainingPlanForm } from '@/shared/api/trainings';
import { useEmployees } from './trainingMeta';

/**
 * 新建与编辑培训计划（需求 11.3）。
 *
 * <p><b>关联课程这里不限已发布</b>（需求 11.3 第 3 项，V1.2）：计划常常在课程还没发布时就先排上了，
 * 在计划这一级拦下来会逼运营等课程发布后再补录，而那时计划的开始日期已经过去了。
 * 「课程可发布」的校验在<b>建场次</b>时执行。
 *
 * <p><b>没有版本号。</b>培训计划不在带 {@code version} 的三张表里（规则 K1），
 * 编辑时不回传版本，冲突以最后保存的为准。
 */

interface TrainingPlanFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为新建 */
  plan?: TrainingPlan;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
}

interface FormValues {
  planName: string;
  courseId: number;
  ownerNo: string;
  targetScope: string;
  planRange: [Dayjs, Dayjs];
  planSessionCount?: number | null;
  remark?: string | null;
}

export function TrainingPlanFormModal({
  open,
  plan,
  onClose,
  onCreated,
  onUpdated,
}: TrainingPlanFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const employees = useEmployees();
  const [courseKeyword, setCourseKeyword] = useState('');

  // 课程是数百量级：按关键字搜前 20 条，长下拉帮不上忙（运营记得住课名，记不住课程ID）
  const courses = useQuery({
    queryKey: ['courses', 'plan-picker', courseKeyword],
    queryFn: () => courseApi.page({ keyword: courseKeyword || null }, 1, 20),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    if (plan) {
      form.setFieldsValue({
        planName: plan.planName,
        courseId: plan.courseId,
        ownerNo: plan.ownerNo,
        targetScope: plan.targetScope,
        planRange: [dayjs(plan.planStartDate), dayjs(plan.planEndDate)],
        planSessionCount: plan.planSessionCount,
        remark: plan.remark,
      });
    } else {
      form.resetFields();
    }
  }, [open, plan, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: TrainingPlanForm = {
        planName: values.planName,
        courseId: values.courseId,
        ownerNo: values.ownerNo,
        targetScope: values.targetScope,
        planStartDate: values.planRange[0].format('YYYY-MM-DD'),
        planEndDate: values.planRange[1].format('YYYY-MM-DD'),
        planSessionCount: values.planSessionCount ?? null,
        remark: values.remark ?? null,
      };
      return plan
        ? trainingApi.updatePlan(plan.id, payload).then(() => plan.id)
        : trainingApi.createPlan(payload);
    },
    onSuccess: (id) => {
      message.success(plan ? '培训计划已保存' : '培训计划已创建');
      if (plan) {
        onUpdated?.();
      } else {
        onCreated?.(id);
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  // 编辑时下拉里未必有这门课（关键字没命中），补一条当前值免得显示成空
  const courseOptions = (courses.data?.records ?? []).map((item) => ({
    value: item.id,
    label: `${item.courseName}（${item.courseNo}）`,
  }));
  if (plan && !courseOptions.some((option) => option.value === plan.courseId)) {
    courseOptions.unshift({
      value: plan.courseId,
      label: plan.courseName ? `${plan.courseName}（当前关联）` : `课程 #${plan.courseId}`,
    });
  }

  return (
    <Modal
      open={open}
      title={plan ? `编辑培训计划 ${plan.planNo}` : '新建培训计划'}
      okText="保存"
      cancelText="取消"
      width={640}
      confirmLoading={save.isPending}
      onCancel={onClose}
      // 校验不通过时 validateFields 会 reject，错误已由表单在字段下显示，这里咽掉即可
      onOk={() => void form.validateFields().then((values) => save.mutateAsync(values)).catch(() => undefined)}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="计划名称" name="planName" rules={[{ required: true, message: '请填写计划名称' }]}>
          <Input maxLength={100} showCount />
        </Form.Item>
        <Form.Item
          label="关联课程"
          name="courseId"
          extra="计划这一级不校验课程状态，排课时才校验——计划常常在课程还没做完时就先排上了"
          rules={[{ required: true, message: '请选择关联课程' }]}
        >
          <Select
            showSearch
            filterOption={false}
            onSearch={setCourseKeyword}
            notFoundContent={courses.isLoading ? '加载中' : '没有匹配的课程'}
            options={courseOptions}
          />
        </Form.Item>
        <Form.Item
          label="培训负责人"
          name="ownerNo"
          extra="负责人只是台账信息，不影响谁能编辑这个计划——运营账号可以编辑任何计划"
          rules={[{ required: true, message: '请选择培训负责人' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={(employees.data?.records ?? []).map((item) => ({
              value: item.employeeNo,
              label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="面向人群范围"
          name="targetScope"
          extra="文本描述，如「MSS 三层部门全体」"
          rules={[{ required: true, message: '请填写面向人群范围' }]}
        >
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
        <Form.Item
          label="计划起止日期"
          name="planRange"
          rules={[{ required: true, message: '请选择计划起止日期' }]}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="计划场次数"
          name="planSessionCount"
          extra="留空表示还没定。实际场次数由下属场次实时统计，不需要手工维护"
        >
          <InputNumber min={1} max={999} style={{ width: '100%' }} addonAfter="场" />
        </Form.Item>
        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={3} maxLength={1000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
