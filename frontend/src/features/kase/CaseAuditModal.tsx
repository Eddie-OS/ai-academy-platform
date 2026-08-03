import { useEffect } from 'react';
import { App, Alert, DatePicker, Form, Input, Modal, Select, Space } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { caseApi, type CaseInfo } from '@/shared/api/cases';
import { space } from '@/shared/theme/designTokens';
import { FIELD_ENUM_KEYS, selectOptions, useEmployees, useFieldEnums } from './caseMeta';

/**
 * 录入案例审核结论（需求 12.3 第 9a～9d 项、5.9 后两行）。
 *
 * <p><b>四个字段与状态一起提交。</b>后端在同一个事务里写字段、推状态：拆成「先改状态再补字段」
 * 会让「已上架但审核人是空的」这条记录真实存在过，而那正是 C9 硬阻断要防的东西。
 *
 * <p><b>审核不记轮次</b>（C09 第 4 条）：这一次录的结论直接覆盖上一次，界面上也没有历史列表。
 * 与课程评审、需求验收都不同——那两个每一轮都留档。
 */

interface CaseAuditModalProps {
  open: boolean;
  caseInfo: CaseInfo;
  onClose: () => void;
  onRecorded: () => void;
}

interface FormValues {
  reviewerNo: string;
  reviewedAt: dayjs.Dayjs;
  reviewResult: string;
  reviewOpinion?: string;
}

export function CaseAuditModal({ open, caseInfo, onClose, onRecorded }: CaseAuditModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();

  const results = fieldEnums.data?.[FIELD_ENUM_KEYS.caseAuditResult] ?? [];
  const chosen = Form.useWatch('reviewResult', form);
  // 「通过」是第一个取值（后端 CaseEnums.REVIEW_RESULTS 的定义顺序）。按下标取而不是比较
  // 字面量：提示文案要区分两种结论，但认出它们的方式不能是把中文抄进前端（纪律 STK-1）
  const pass = results[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    form.resetFields();
    form.setFieldsValue({
      reviewerNo: caseInfo.reviewerNo ?? undefined,
      reviewedAt: dayjs(),
      reviewResult: caseInfo.reviewResult ?? undefined,
      reviewOpinion: caseInfo.reviewOpinion ?? undefined,
    });
  }, [open, caseInfo, form]);

  const submit = useMutation({
    mutationFn: (values: FormValues) =>
      caseApi.audit(caseInfo.id, {
        reviewerNo: values.reviewerNo,
        reviewedAt: values.reviewedAt.format('YYYY-MM-DD'),
        reviewResult: values.reviewResult,
        reviewOpinion: values.reviewOpinion ?? null,
        version: caseInfo.version,
      }),
    onSuccess: () => {
      message.success('审核结论已录入');
      onRecorded();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '录入失败，请重试'),
  });

  return (
    <Modal
      open={open}
      title={`录入审核结论 · ${caseInfo.caseName}`}
      okText="保存并变更状态"
      cancelText="取消"
      width={600}
      confirmLoading={submit.isPending}
      onCancel={onClose}
      onOk={() =>
        void form
          .validateFields()
          .then((values) => submit.mutateAsync(values))
          .catch(() => undefined)
      }
    >
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="平台只记录线下审核的结果"
          description="结论由线下评审得出，平台不判断内容是否合格。审核不记轮次——这次录入会覆盖上一次的审核人、审核时间与意见。"
        />
        {caseInfo.reviewResult && (
          <Alert
            type="warning"
            showIcon
            message={`这条案例已有审核结论：${caseInfo.reviewResult}`}
            description={`审核人 ${caseInfo.reviewerName ?? caseInfo.reviewerNo ?? '—'} · ${caseInfo.reviewedAt ?? '—'}。保存后旧结论不再保留。`}
          />
        )}
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="审核人" name="reviewerNo" rules={[{ required: true, message: '请选择审核人' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={employees.isLoading}
              options={(employees.data?.records ?? []).map((item) => ({
                value: item.employeeNo,
                label: `${item.employeeName}（${item.employeeNo}·${item.deptName}）`,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="审核时间"
            name="reviewedAt"
            extra="填线下实际审核的日期，不是今天录入的日期"
            rules={[{ required: true, message: '请选择审核时间' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="审核结论"
            name="reviewResult"
            extra={
              chosen === undefined
                ? undefined
                : chosen === pass
                  ? '保存后案例上架，并记下首次上架时间'
                  : '保存后案例退回上一档，改完可以再次提交审核'
            }
            rules={[{ required: true, message: '请选择审核结论' }]}
          >
            <Select options={selectOptions(results)} />
          </Form.Item>
          <Form.Item label="审核意见" name="reviewOpinion">
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}
