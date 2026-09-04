import { useEffect, useState } from 'react';
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { courseApi } from '@/shared/api/courses';
import { trainingApi, type TrainingPlan, type TrainingPlanForm } from '@/shared/api/trainings';
import {
  TRAINING_OBJECT_TYPE_CODES,
  TRAINING_STATE_FIELDS,
  useEmployees,
  useStates,
} from './trainingMeta';
import '@/shared/theme/form-modal-v2.css';
import './trainingPlanFormModal.css';

/**
 * 新建与编辑培训计划（需求 11.3）。
 *
 * <p>产品表单按「培训计划基本信息」字段序铺：编号、名称、状态、介绍、课程、负责人、
 * 计划场次、实际场次、实际人次、计划时间、实际时间、备注。能落库的走 {@link TrainingPlanForm}；
 * 系统生成或实时汇总的只展示。
 *
 * <p><b>状态不在表单里改。</b>新建由状态机写入初始状态，之后走统一转换接口（需求 5.7）。
 * 下拉选项来自 {@code /api/meta/enums}，不手写状态值（纪律 STK-1）。
 *
 * <p><b>一门计划只关联一门课</b>（需求 3.3 R8）。授课讲师挂在场次上，计划这一级不绑人。
 * 实际场次是下属场次 COUNT，实际完成时间在计划首次进入完成态时写入，都不允许手填
 * （需求 11.3 第 10、12 项）。
 *
 * <p><b>计划时间是日期不是时分。</b>三色灯按自然日算计划结束日；钟点在场次上填。
 *
 * <p><b>没有版本号。</b>培训计划不在带 {@code version} 的三张表里（规则 K1）。
 */

interface TrainingPlanFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为新建 */
  plan?: TrainingPlan;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
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
  onDeleted,
}: TrainingPlanFormModalProps) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const employees = useEmployees();
  const planStates = useStates(TRAINING_OBJECT_TYPE_CODES.plan, TRAINING_STATE_FIELDS.plan);
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

  const remove = useMutation({
    mutationFn: () => trainingApi.deletePlan(plan!.id),
    onSuccess: () => {
      message.success('培训计划已删除');
      onDeleted?.();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
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

  const employeeOptions = (employees.data?.records ?? []).map((item) => ({
    value: item.employeeNo,
    label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
  }));

  return (
    <Modal
      open={open}
      title={plan ? `编辑培训计划 ${plan.planNo}` : '新建培训计划'}
      width={1100}
      centered
      zIndex={1200}
      className="training-plan-form-modal crs-form-modal"
      rootClassName="crs-form-modal-root"
      destroyOnHidden
      onCancel={onClose}
      footer={
        <>
          {plan ? (
            <Button
              className="crs-form-modal-delete"
              danger
              disabled={save.isPending}
              loading={remove.isPending}
              onClick={() =>
                modal.confirm({
                  title: `删除培训计划「${plan.planNo}」？`,
                  content: '该计划下还有场次时不能删除，请先在「培训场次记录」里删除场次。',
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
            onClick={() =>
              void form.validateFields().then((values) => save.mutateAsync(values)).catch(() => undefined)
            }
          >
            保存
          </Button>
        </>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark
        data-testid="training-plan-form"
      >
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item
              label="培训计划编号"
              extra="保存后自动生成，规则为 JH + 年月 + 3 位流水"
            >
              <Input disabled value={plan?.planNo ?? ''} placeholder="保存后自动生成" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="培训计划状态"
              extra="新建后写入初始状态，之后在详情里手动流转，不在这里改"
            >
              <Select
                disabled
                value={plan?.planState}
                placeholder="保存后由系统写入初始状态"
                options={planStates.map((state) => ({ value: state, label: state }))}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="培训计划名称"
              name="planName"
              rules={[{ required: true, message: '请填写培训计划名称' }]}
            >
              <Input maxLength={100} showCount placeholder="请填写培训计划全称" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="培训介绍"
              name="targetScope"
              extra="面向人群、培训目标等，如「MSS 三层部门全体」"
              rules={[{ required: true, message: '请填写培训介绍' }]}
            >
              <Input.TextArea rows={4} maxLength={500} showCount placeholder="请填写面向人群、培训目标等" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="培训课程"
              name="courseId"
              extra="一门计划对应一门课；同一门课可另建计划。计划级不校验课程的发布状态"
              rules={[{ required: true, message: '请选择培训课程' }]}
            >
              <Select
                showSearch
                filterOption={false}
                placeholder="请从课程工作台选择"
                onSearch={setCourseKeyword}
                notFoundContent={courses.isLoading ? '加载中' : '没有匹配的课程'}
                options={courseOptions}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="授课讲师" extra="讲师挂在场次上，排场次时从讲师池选择，可按场换人">
              <Select disabled mode="multiple" placeholder="排场次时从讲师池选择" options={[]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="运营负责人"
              name="ownerNo"
              extra="台账字段，不影响谁能编辑这个计划——运营账号可以编辑任何计划"
              rules={[{ required: true, message: '请选择运营负责人' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择运营负责人"
                options={employeeOptions}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="计划培训场次"
              name="planSessionCount"
              extra="预计要办几场。留空表示还没定"
            >
              <InputNumber min={1} max={999} style={{ width: '100%' }} placeholder="请输入" addonAfter="场" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="实际完成场次" extra="下属场次记录数，关联场次后由系统汇总">
              <InputNumber
                disabled
                style={{ width: '100%' }}
                value={plan ? plan.actualSessionCount : undefined}
                placeholder="关联场次后自动汇总"
                addonAfter="场"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="实际参训人数" extra="各场签到人数合计，导入签到后由系统汇总">
              <InputNumber disabled style={{ width: '100%' }} placeholder="导入签到后自动汇总" addonAfter="人" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="计划培训时间"
              name="planRange"
              extra="按自然日选择；钟点在场次上填。结束日是三色灯的判定基准"
              rules={[{ required: true, message: '请选择计划培训时间' }]}
            >
              <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['开始日期', '结束日期']} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="实际培训时间" extra="计划首次完成后自动写入，不在这里手填">
              <DatePicker
                disabled
                style={{ width: '100%' }}
                value={plan?.actualFinishDate ? dayjs(plan.actualFinishDate) : undefined}
                placeholder="完成后自动写入"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={4} maxLength={1000} showCount placeholder="补充说明，选填" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
