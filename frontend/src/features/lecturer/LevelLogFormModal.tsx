import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { lecturerApi, type Lecturer, type LevelLogForm, type LevelLogRecord } from '@/shared/api/lecturers';
import { FIELD_ENUM_KEYS, selectOptions, useFieldEnums } from './lecturerMeta';

const LEVEL_HINT = 'L0 新手/合格 · L1 单课/单元 · L2 MGS 三级 · L3 标准化课程 · L4 MGS 二级';

interface LevelLogFormModalProps {
  open: boolean;
  lecturer: Lecturer;
  record?: LevelLogRecord;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  triggerReason?: string;
  changeDesc?: string;
  changedOn?: Dayjs | null;
  levelAfter: string;
  reviewer?: string;
  reviewComment?: string;
}

export function LevelLogFormModal({
  open,
  lecturer,
  record,
  onClose,
  onSaved,
}: LevelLogFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const levels = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerLevel]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({
        triggerReason: record.triggerReason ?? undefined,
        changeDesc: record.changeDesc ?? undefined,
        changedOn: record.changedOn ? dayjs(record.changedOn) : undefined,
        levelAfter: record.levelAfter,
        reviewer: record.reviewer ?? undefined,
        reviewComment: record.reviewComment ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        levelAfter: lecturer.lecturerLevel ?? fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerLevel]?.[0],
      });
    }
  }, [open, record, form, fieldEnums.data, lecturer.lecturerLevel]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: LevelLogForm = {
        triggerReason: values.triggerReason || null,
        changeDesc: values.changeDesc || null,
        changedOn: values.changedOn?.format('YYYY-MM-DD') ?? null,
        levelAfter: values.levelAfter,
        reviewer: values.reviewer || null,
        reviewComment: values.reviewComment || null,
      };
      if (record) {
        await lecturerApi.updateLevelLog(lecturer.id, record.id, payload);
        return;
      }
      await lecturerApi.createLevelLog(lecturer.id, payload);
    },
    onSuccess: () => {
      message.success(record ? '等级变更记录已保存' : '等级变更记录已建档');
      onSaved();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '保存失败，请重试'),
  });

  return (
    <Modal
      title={record ? '编辑等级变更记录' : '新建等级变更记录'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={save.isPending}
      width={720}
      destroyOnClose
      data-testid="level-log-form-modal"
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
          {record ? (
            <Col span={12}>
              <Form.Item label="变更记录编号">
                <Input value={record.changeNo} disabled />
              </Form.Item>
            </Col>
          ) : (
            <Col span={12}>
              <Form.Item label="变更记录编号" extra="保存后由系统按 BG + 流水生成">
                <Input value="保存后生成" disabled />
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item
              label="变更后等级"
              name="levelAfter"
              extra={LEVEL_HINT}
              rules={[{ required: true, message: '请选择变更后等级' }]}
            >
              <Select options={levels} placeholder="请选择变更后等级" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="变更触发原因"
              name="triggerReason"
              extra="定期评审、能力达标、考核未通过、专项认证等，手工填写"
            >
              <Input maxLength={200} placeholder="如 定期评审" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="等级变更说明" name="changeDesc">
              <Input maxLength={500} placeholder="如 由 L1 变更为 L2" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="等级变更时间" name="changedOn">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="评审人" name="reviewer">
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="评审意见" name="reviewComment">
              <Input.TextArea rows={3} maxLength={5000} showCount />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
