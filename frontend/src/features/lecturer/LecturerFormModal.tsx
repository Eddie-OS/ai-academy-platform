import { useEffect, useState } from 'react';
import { App, Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd';
import type { UploadFile } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { lecturerApi, type Lecturer, type LecturerForm } from '@/shared/api/lecturers';
import { attachmentApi } from '@/shared/api/attachments';
import { personByNo } from '@/fixtures/people';
import { useAuthStore } from '@/shared/store/authStore';
import { LecturerAvatarField } from './LecturerAvatarField';
import {
  FIELD_ENUM_KEYS,
  selectOptions,
  useEmployees,
  useExpertiseDomains,
  useFieldEnums,
} from './lecturerMeta';
import './lecturerFormModal.css';

/**
 * 手动添加与编辑讲师。可填项按业务确认的基础档案口径。
 *
 * <p>工号手输，仍须在人员台账。来源部门是零售／服务等七类；擅长领域自由填写。
 * 入池方式、试讲合格标记不在表单里。培养状态不出现——新建选的是上岗状态，
 * 后端保存时把培养状态对齐过去。
 */

interface LecturerFormModalProps {
  open: boolean;
  lecturer?: Lecturer;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
}

interface FormValues {
  lecturerName: string;
  employeeNo: string;
  sourceDept: string;
  expertiseDomains: string;
  teachingDirection: string;
  dutyState: string;
  lecturerLevel: string;
  capabilityTags?: string;
  availableTime?: string;
  scheduleLimit?: string;
  joinedDate: Dayjs;
  profileMaintainer?: string;
  remark?: string;
  poolState: string;
  removedReason?: string | null;
}

export function LecturerFormModal({
  open,
  lecturer,
  onClose,
  onCreated,
  onUpdated,
}: LecturerFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();
  const domains = useExpertiseDomains();
  const account = useAuthStore((state) => state.account);
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null);
  const [avatarList, setAvatarList] = useState<UploadFile[]>([]);

  const dutyList = fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerDutyState];
  const levelList = fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerLevel];
  const poolStates = fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerPoolState];
  const dutyStates = selectOptions(dutyList);
  const levels = selectOptions(levelList);
  const poolOut = poolStates?.[1];
  const enumsReady = Boolean(dutyList && levelList && poolStates);
  const poolState = Form.useWatch('poolState', form);
  const employeeNo = Form.useWatch('employeeNo', form);

  useEffect(() => {
    if (!open || !enumsReady) {
      return;
    }
    if (lecturer) {
      form.setFieldsValue({
        lecturerName: lecturer.lecturerName,
        employeeNo: lecturer.employeeNo,
        sourceDept: lecturer.sourceDept,
        expertiseDomains: lecturer.expertiseDomains.join('、'),
        teachingDirection: lecturer.teachingDirection,
        dutyState: lecturer.dutyState ?? fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerDutyState]?.[0],
        lecturerLevel: lecturer.lecturerLevel ?? fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerLevel]?.[0],
        capabilityTags: lecturer.capabilityTags ?? undefined,
        availableTime: lecturer.availableTime ?? undefined,
        scheduleLimit: lecturer.scheduleLimit ?? undefined,
        joinedDate: lecturer.joinedDate ? dayjs(lecturer.joinedDate) : dayjs(),
        profileMaintainer: lecturer.profileMaintainer ?? undefined,
        remark: lecturer.remark ?? undefined,
        poolState: lecturer.poolState,
        removedReason: lecturer.removedReason,
      });
      setAvatarId(lecturer.avatarAttachmentId);
      setAvatarPreset(lecturer.avatarAttachmentId ? null : lecturer.avatarPreset);
      setAvatarList(
        lecturer.avatarAttachmentId
          ? [
              {
                uid: String(lecturer.avatarAttachmentId),
                name: '头像',
                status: 'done',
                url: attachmentApi.downloadUrl(lecturer.avatarAttachmentId),
              },
            ]
          : [],
      );
    } else {
      form.resetFields();
      form.setFieldsValue({
        dutyState: fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerDutyState]?.[1],
        lecturerLevel: fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerLevel]?.[0],
        joinedDate: dayjs(),
        profileMaintainer: account?.displayName,
        poolState: fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerPoolState]?.[0],
      });
      setAvatarId(null);
      setAvatarPreset(null);
      setAvatarList([]);
    }
  }, [open, lecturer, form, enumsReady, account?.displayName]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: LecturerForm = {
        lecturerName: values.lecturerName,
        employeeNo: values.employeeNo,
        sourceDept: values.sourceDept,
        expertiseDomains: splitExpertise(values.expertiseDomains),
        teachingDirection: values.teachingDirection,
        dutyState: values.dutyState,
        lecturerLevel: values.lecturerLevel,
        capabilityTags: values.capabilityTags ?? null,
        availableTime: values.availableTime ?? null,
        scheduleLimit: values.scheduleLimit ?? null,
        joinedDate: values.joinedDate.format('YYYY-MM-DD'),
        profileMaintainer: values.profileMaintainer ?? null,
        remark: values.remark ?? null,
        avatarAttachmentId: avatarId,
        avatarPreset,
        poolState: values.poolState,
        removedReason: values.removedReason ?? null,
      };
      return lecturer
        ? lecturerApi.update(lecturer.id, payload).then(() => lecturer.id)
        : lecturerApi.create(payload);
    },
    onSuccess: (id) => {
      message.success(lecturer ? '讲师档案已保存' : '讲师已入池');
      if (lecturer) {
        onUpdated?.();
      } else {
        onCreated?.(id);
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const fillFromEmployee = (nextEmployeeNo: string) => {
    const employee = employees.data?.records.find((item) => item.employeeNo === nextEmployeeNo.trim());
    if (employee) {
      form.setFieldsValue({ lecturerName: employee.employeeName });
    }
    const roster = personByNo(nextEmployeeNo.trim());
    if (roster && !avatarId) {
      setAvatarPreset(roster.avatar);
    }
  };

  const sourceDeptOptions = [
    ...domains.map((value) => ({ value, label: value })),
    ...(lecturer?.sourceDept && !domains.includes(lecturer.sourceDept)
      ? [{ value: lecturer.sourceDept, label: lecturer.sourceDept }]
      : []),
  ];

  return (
    <Modal
      open={open}
      title={lecturer ? `编辑讲师 ${lecturer.lecturerNo}` : '添加讲师'}
      okText="保存"
      cancelText="取消"
      width={1120}
      centered
      className="lecturer-form-modal"
      destroyOnHidden
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() => {
        void form
          .validateFields()
          .then((values) => save.mutateAsync(values))
          .catch(() => undefined);
      }}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Form form={form} layout="vertical" requiredMark>
        {!lecturer && <p className="lecturer-form-lead">由运营填写讲师基础档案。</p>}
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="讲师ID" extra="唯一标识，保存后由系统按 JS + 4 位流水自动生成">
              <Input value={lecturer?.lecturerNo ?? '保存后自动生成'} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="讲师姓名"
              name="lecturerName"
              rules={[{ required: true, message: '请填写讲师姓名' }]}
            >
              <Input maxLength={50} showCount placeholder="请填写讲师姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="工号"
              name="employeeNo"
              extra="请填写人员台账中的工号。填写后可带出姓名与头像。同一个人只能入池一次"
              rules={[{ required: true, message: '请填写工号' }]}
            >
              <Input
                maxLength={50}
                disabled={Boolean(lecturer)}
                placeholder="请填写工号"
                onBlur={(event) => fillFromEmployee(event.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="来源部门"
              name="sourceDept"
              extra="零售、服务、GTM 等现场口径，不是人员台账里的三级部门"
              rules={[{ required: true, message: '请选择来源部门' }]}
            >
              <Select placeholder="请选择来源部门" options={sourceDeptOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="讲师等级"
              name="lecturerLevel"
              rules={[{ required: true, message: '请选择讲师等级' }]}
            >
              <Select placeholder="请选择讲师等级" options={levels} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="上岗状态"
              name="dutyState"
              extra="只有「可上岗」的讲师才能被排课"
              rules={[{ required: true, message: '请选择上岗状态' }]}
            >
              <Select placeholder="请选择上岗状态" options={dutyStates} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="擅长领域"
              name="expertiseDomains"
              extra="自由填写，多个用顿号或逗号分隔"
              rules={[{ required: true, message: '请填写擅长领域' }]}
            >
              <Input maxLength={200} placeholder="请填写擅长领域" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="能力标签" name="capabilityTags">
              <Input maxLength={500} placeholder="技能／业务标签，逗号分隔" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="讲师简介"
              name="teachingDirection"
              rules={[{ required: true, message: '请填写讲师简介' }]}
            >
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="请填写讲师简介" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="讲师头像"
              extra="可从平台现有的 60 张中选一张，也可自行上传。上传后以上传的为准。"
            >
              <LecturerAvatarField
                employeeNo={employeeNo}
                preset={avatarPreset}
                fileList={avatarList}
                onPresetChange={(key) => {
                  setAvatarPreset(key);
                  setAvatarId(null);
                  setAvatarList([]);
                }}
                onUploaded={(file, id) => {
                  setAvatarId(id);
                  setAvatarPreset(null);
                  setAvatarList([file]);
                }}
                onUploadCleared={() => {
                  setAvatarId(null);
                  setAvatarList([]);
                }}
                onError={(text) => message.error(text)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="可授课时间" name="availableTime">
              <Input maxLength={200} placeholder="闲时描述，如每周三下午" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="排课限制说明" name="scheduleLimit">
              <Input maxLength={200} placeholder="如每月不超过 3 场、不排夜班" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="建档时间"
              name="joinedDate"
              rules={[{ required: true, message: '请选择建档时间' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="档案维护人" name="profileMaintainer">
              <Input maxLength={50} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="在池状态"
              name="poolState"
              rules={[{ required: true, message: '请选择在池状态' }]}
            >
              <Select placeholder="请选择在池状态" options={selectOptions(poolStates)} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="备注信息" name="remark" extra="非结构化但重要的补充信息">
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="选填" />
            </Form.Item>
          </Col>
          {poolState === poolOut && (
            <Col span={24}>
              <Form.Item
                label="移出原因"
                name="removedReason"
                extra="移出保留全部授课与试讲历史，与删除不同"
                rules={[{ required: true, message: '移出讲师池时必须填写移出原因' }]}
              >
                <Input.TextArea rows={2} maxLength={500} showCount />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  );
}

function splitExpertise(value: string): string[] {
  return value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
