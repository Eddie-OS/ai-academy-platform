import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import {
  lecturerApi,
  type CertificationForm,
  type CertificationRecord,
  type Lecturer,
} from '@/shared/api/lecturers';
import { FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './lecturerMeta';

const LEVEL_HINT = 'L0 新手/合格 · L1 单课/单元 · L2 MGS 三级 · L3 标准化课程 · L4 MGS 二级';

interface CertFormModalProps {
  open: boolean;
  lecturer: Lecturer;
  record?: CertificationRecord;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  certBatch?: string;
  lecturerLevel?: string;
  certState: string;
  reviewers?: string;
  opinion?: string;
  passedOn?: Dayjs | null;
  validRange?: [Dayjs, Dayjs] | null;
}

export function CertFormModal({ open, lecturer, record, onClose, onSaved }: CertFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const levels = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerLevel]);
  const states = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerCertState]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({
        certBatch: record.certBatch ?? undefined,
        lecturerLevel: record.lecturerLevel ?? undefined,
        certState: record.certState,
        reviewers: record.reviewers ?? undefined,
        opinion: record.opinion ?? undefined,
        passedOn: record.passedOn ? dayjs(record.passedOn) : undefined,
        validRange:
          record.validFrom && record.validTo
            ? [dayjs(record.validFrom), dayjs(record.validTo)]
            : undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        certState: fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerCertState]?.[0],
        lecturerLevel: lecturer.lecturerLevel ?? undefined,
      });
    }
  }, [open, record, form, fieldEnums.data, lecturer.lecturerLevel]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CertificationForm = {
        certBatch: values.certBatch || null,
        lecturerLevel: values.lecturerLevel || null,
        certState: values.certState,
        reviewers: values.reviewers || null,
        opinion: values.opinion || null,
        passedOn: values.passedOn?.format('YYYY-MM-DD') ?? null,
        validFrom: values.validRange?.[0]?.format('YYYY-MM-DD') ?? null,
        validTo: values.validRange?.[1]?.format('YYYY-MM-DD') ?? null,
      };
      if (record) {
        await lecturerApi.updateCertification(lecturer.id, record.id, payload);
        return;
      }
      await lecturerApi.createCertification(lecturer.id, payload);
    },
    onSuccess: () => {
      message.success(record ? '认证记录已保存' : '认证记录已建档');
      onSaved();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '保存失败，请重试'),
  });

  return (
    <Modal
      title={record ? '编辑认证记录' : '新建认证记录'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={save.isPending}
      width={720}
      destroyOnClose
      data-testid="cert-form-modal"
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
          <Col span={12}>
            <Form.Item label="认证批次" name="certBatch">
              <Input maxLength={64} placeholder="如 2026-08 批次" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="讲师等级" name="lecturerLevel" extra={LEVEL_HINT}>
              <Select allowClear options={levels} placeholder="请选择讲师等级" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="认证状态" name="certState" rules={[{ required: true, message: '请选择认证状态' }]}>
              <Select options={states} placeholder="请选择认证状态" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="认证通过时间" name="passedOn">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="评审人" name="reviewers">
              <Input.TextArea rows={2} maxLength={500} showCount placeholder="认证评审人员" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="认证意见" name="opinion">
              <Input.TextArea rows={3} maxLength={5000} showCount placeholder="评审反馈、整改要求" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="认证有效期" name="validRange">
              <DatePicker.RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
