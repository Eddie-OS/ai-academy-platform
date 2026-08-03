import { useEffect } from 'react';
import { App, DatePicker, Form, Input, Modal, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { demandApi, type Demand, type DemandForm } from '@/shared/api/demands';
import {
  DICT_KEYS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useDicts,
  useEmployees,
  useFieldEnums,
} from './demandMeta';

/**
 * 需求登记与基本信息编辑（需求 8.3.1）。
 *
 * <p>登记与编辑共用一张表单：可编辑字段完全相同，拆成两个组件必然出现「新建能填、编辑填不了」
 * 的字段差异。
 *
 * <p><b>提出人部门不在表单里</b>（需求 8.3.1 第 5 项）：它随提出人自动带出，给运营一个可手填的
 * 部门，等于允许它与人员台账不一致，而这条快照日后是「当初是哪个部门提的」的唯一依据。
 *
 * <p><b>分流出口也不在这里</b>：它随「录入评审结论」一起录入（需求 5.2.1 要求两者必须同时），
 * 放进通用编辑表单就表达不出这个「必须同时」。
 *
 * <p>编辑时必须回传 {@code version}（规则 K1）。共享账号下两名运营同时改同一条需求是常态，
 * 冲突时后端给 {@code CONCURRENT_MODIFIED}，这里原样展示后端文案——它带着最后修改时间。
 */

interface DemandFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为登记 */
  demand?: Demand;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
}

interface FormValues extends Omit<DemandForm, 'proposedDate' | 'expectFinishDate'> {
  proposedDate: Dayjs;
  expectFinishDate: Dayjs;
}

export function DemandFormModal({ open, demand, onClose, onCreated, onUpdated }: DemandFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const dicts = useDicts();
  const employees = useEmployees();

  useEffect(() => {
    if (!open) {
      return;
    }
    if (demand) {
      form.setFieldsValue({
        demandName: demand.demandName,
        domainCode: demand.domainCode,
        proposerNo: demand.proposerNo,
        ownerNo: demand.ownerNo,
        proposedDate: dayjs(demand.proposedDate),
        expectFinishDate: dayjs(demand.expectFinishDate),
        description: demand.description,
        demandSource: demand.demandSource,
        demandType: demand.demandType,
        priority: demand.priority,
      });
    } else {
      form.resetFields();
      // 提出时间默认当天（需求 8.3.1 第 8 项）
      form.setFieldsValue({ proposedDate: dayjs() });
    }
  }, [open, demand, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: DemandForm = {
        ...values,
        proposedDate: values.proposedDate.format('YYYY-MM-DD'),
        expectFinishDate: values.expectFinishDate.format('YYYY-MM-DD'),
      };
      return demand
        ? demandApi.update(demand.id, payload, demand.version).then(() => demand.id)
        : demandApi.register(payload);
    },
    onSuccess: (id) => {
      message.success(demand ? '需求信息已保存' : '需求已登记');
      if (demand) {
        onUpdated?.();
      } else {
        onCreated?.(id);
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const employeeOptions = (employees.data?.records ?? []).map((item) => ({
    value: item.employeeNo,
    // 人员状态直接显示出来：离职的人照样可选（历史需求要能编辑），由运营自己判断
    label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
  }));

  return (
    <Modal
      open={open}
      title={demand ? `编辑需求 ${demand.demandNo}` : '登记需求'}
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
        <Form.Item label="需求名称" name="demandName" rules={[{ required: true, message: '请填写需求名称' }]}>
          <Input maxLength={100} showCount />
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
          label="需求提出人"
          name="proposerNo"
          extra="提出人部门随提出人自动带出并留存快照，日后人员调岗不影响这条需求的历史记录"
          rules={[{ required: true, message: '请选择需求提出人' }]}
        >
          <Select showSearch optionFilterProp="label" options={employeeOptions} />
        </Form.Item>
        <Form.Item
          label="需求负责人"
          name="ownerNo"
          extra="负责人只是台账信息，不影响谁能编辑这条需求——运营账号可以编辑任何需求"
          rules={[{ required: true, message: '请选择需求负责人' }]}
        >
          <Select showSearch optionFilterProp="label" options={employeeOptions} />
        </Form.Item>
        <Form.Item label="提出时间" name="proposedDate" rules={[{ required: true, message: '请填写提出时间' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="预计开发完成时间"
          name="expectFinishDate"
          extra="三色灯按它判定「即将到期」与「已逾期」，填得越准，预警越有用"
          rules={[{ required: true, message: '请填写预计开发完成时间' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="需求描述"
          name="description"
          extra="写清业务问题与使用场景，它是线下评审判断出口的依据"
          rules={[{ required: true, message: '请填写需求描述' }]}
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
        <Form.Item label="需求来源" name="demandSource">
          <Select allowClear options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandSource])} />
        </Form.Item>
        <Form.Item label="需求类型" name="demandType">
          <Select allowClear options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandType])} />
        </Form.Item>
        <Form.Item label="优先级" name="priority" extra="只用于列表排序与筛选，不驱动任何自动逻辑">
          <Select allowClear options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandPriority])} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
