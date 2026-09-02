import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import {
  lecturerApi,
  type CultivationForm,
  type CultivationRecord,
  type Lecturer,
} from '@/shared/api/lecturers';
import { AttachmentField, ATTACHMENT_SCENE_GENERAL } from '@/shared/ui/AttachmentField';
import { FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './lecturerMeta';

const PLAN_ACCEPT = '.xls,.xlsx,.doc,.docx,.ppt,.pptx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

interface CultivationFormModalProps {
  open: boolean;
  lecturer: Lecturer;
  record?: CultivationRecord;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  planText?: string;
  plannedRange?: [Dayjs, Dayjs] | null;
  cultivationTypes?: string[];
  recordText?: string;
  actualRange?: [Dayjs, Dayjs] | null;
  planState: string;
  evaluation?: string;
  remark?: string;
}

export function CultivationFormModal({
  open,
  lecturer,
  record,
  onClose,
  onSaved,
}: CultivationFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const types = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerCultivationType]);
  const states = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerCultivationPlanState]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({
        planText: record.planText ?? undefined,
        plannedRange:
          record.plannedFrom && record.plannedTo
            ? [dayjs(record.plannedFrom), dayjs(record.plannedTo)]
            : undefined,
        cultivationTypes: record.cultivationTypes,
        recordText: record.recordText ?? undefined,
        actualRange:
          record.actualFrom && record.actualTo
            ? [dayjs(record.actualFrom), dayjs(record.actualTo)]
            : undefined,
        planState: record.planState,
        evaluation: record.evaluation ?? undefined,
        remark: record.remark ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        planState: fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerCultivationPlanState]?.[0],
      });
    }
  }, [open, record, form, fieldEnums.data]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CultivationForm = {
        planText: values.planText || null,
        plannedFrom: values.plannedRange?.[0]?.format('YYYY-MM-DD') ?? null,
        plannedTo: values.plannedRange?.[1]?.format('YYYY-MM-DD') ?? null,
        cultivationTypes: values.cultivationTypes ?? [],
        recordText: values.recordText || null,
        actualFrom: values.actualRange?.[0]?.format('YYYY-MM-DD') ?? null,
        actualTo: values.actualRange?.[1]?.format('YYYY-MM-DD') ?? null,
        planState: values.planState,
        evaluation: values.evaluation || null,
        remark: values.remark || null,
      };
      if (record) {
        await lecturerApi.updateCultivation(lecturer.id, record.id, payload);
        return;
      }
      await lecturerApi.createCultivation(lecturer.id, payload);
    },
    onSuccess: () => {
      message.success(record ? '培养记录已保存' : '培养记录已建档');
      onSaved();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '保存失败，请重试'),
  });

  return (
    <Modal
      title={record ? '编辑培养计划与培养记录' : '新建培养计划与培养记录'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={save.isPending}
      width={720}
      destroyOnClose
      data-testid="cultivation-form-modal"
    >
      <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="讲师ID">
              <Input value={lecturer.lecturerNo} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="讲师姓名">
              <Input value={lecturer.lecturerName} disabled />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="培养计划" name="planText" extra="可写目标，也可在保存后上传 Excel／Word／PPT">
              <Input.TextArea rows={3} maxLength={5000} showCount placeholder="培养目标与安排" />
            </Form.Item>
          </Col>
          {record ? (
            <Col span={24}>
              <Form.Item label="培养计划附件">
                <AttachmentField
                  ownerType="LECTURER_CULTIVATION"
                  ownerId={record.id}
                  refField="plan"
                  emptyHint="可上传 Excel、Word、PPT"
                  scene={ATTACHMENT_SCENE_GENERAL}
                  accept={PLAN_ACCEPT}
                />
              </Form.Item>
            </Col>
          ) : null}
          <Col span={12}>
            <Form.Item label="计划培养周期" name="plannedRange">
              <DatePicker.RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="培养类型" name="cultivationTypes" extra="可多选">
              <Select mode="multiple" allowClear options={types} placeholder="请选择培养类型" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="培养记录" name="recordText" extra="观摩、模拟试讲、辅导、带教等">
              <Input.TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="实际培养周期" name="actualRange">
              <DatePicker.RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="培养状态" name="planState" rules={[{ required: true, message: '请选择培养状态' }]}>
              <Select options={states} placeholder="请选择培养状态" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="培养评价" name="evaluation">
              <Input.TextArea rows={3} maxLength={5000} showCount placeholder="导师反馈与待改进点" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
