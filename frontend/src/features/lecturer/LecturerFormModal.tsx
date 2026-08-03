import { useEffect } from 'react';
import { App, AutoComplete, Form, Input, Modal, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { lecturerApi, type Lecturer, type LecturerForm } from '@/shared/api/lecturers';
import {
  FIELD_ENUM_KEYS,
  selectOptions,
  useEmployees,
  useExpertiseDomains,
  useFieldEnums,
  useSourceDepts,
} from './lecturerMeta';

/**
 * 手动添加与编辑讲师（需求 10.3 的可编辑字段、10.4 第 2 行）。
 *
 * <p><b>表单里没有入池方式、入池时间、试讲合格标记、首次试讲合格时间。</b>前两项由入池路径
 * 决定（走这个弹窗就是「运营手动添加」），后两项只能由试讲结论录入产生。做成可填字段等于
 * 允许伪造一条不存在的试讲记录，而讲师池里「谁试讲过」是排课时唯一能查的依据。
 *
 * <p><b>培养状态在表单里，而其他驾驶舱的状态不在。</b>培养状态是自由选择的枚举（规则 TS1），
 * 不是状态机；改它只写操作审计日志，不写状态流转日志、不影响任何效率指标。
 *
 * <p><b>没有版本号。</b>讲师不在带 {@code version} 的三张表里（规则 K1）。
 */

interface LecturerFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为新建 */
  lecturer?: Lecturer;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
}

interface FormValues {
  lecturerName: string;
  employeeNo: string;
  sourceDept: string;
  expertiseDomains: string[];
  teachingDirection: string;
  trainingState: string;
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
  const sourceDepts = useSourceDepts();

  const trainingStates = selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerTrainingState]);
  const poolStates = fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerPoolState] ?? [];
  // 在池状态的两个取值里，「已移出」是第二个（后端 LecturerEnums.POOL_STATES 的定义顺序）。
  // 按下标取而不是比较字面量：移出原因的条件必填要认出这个取值，但认它的方式不能是写死它
  const poolOut = poolStates[1];
  const poolState = Form.useWatch('poolState', form);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (lecturer) {
      form.setFieldsValue({
        lecturerName: lecturer.lecturerName,
        employeeNo: lecturer.employeeNo,
        sourceDept: lecturer.sourceDept,
        expertiseDomains: lecturer.expertiseDomains,
        teachingDirection: lecturer.teachingDirection,
        trainingState: lecturer.trainingState,
        poolState: lecturer.poolState,
        removedReason: lecturer.removedReason,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        trainingState: fieldEnums.data?.[FIELD_ENUM_KEYS.lecturerTrainingState]?.[0],
        poolState: poolStates[0],
      });
    }
  }, [open, lecturer, form, fieldEnums.data, poolStates]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: LecturerForm = {
        lecturerName: values.lecturerName,
        employeeNo: values.employeeNo,
        sourceDept: values.sourceDept,
        expertiseDomains: values.expertiseDomains,
        teachingDirection: values.teachingDirection,
        trainingState: values.trainingState,
        poolState: values.poolState,
        removedReason: values.removedReason ?? null,
      };
      return lecturer
        ? lecturerApi.update(lecturer.id, payload).then(() => lecturer.id)
        : lecturerApi.create(payload);
    },
    onSuccess: (id) => {
      message.success(lecturer ? '讲师信息已保存' : '讲师已入池');
      if (lecturer) {
        onUpdated?.();
      } else {
        onCreated?.(id);
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  /** 选人时把姓名与部门一并带出：三个字段来自同一条人员记录，让运营再抄一遍只会抄出不一致。 */
  const fillFromEmployee = (employeeNo: string) => {
    const employee = employees.data?.records.find((item) => item.employeeNo === employeeNo);
    if (employee) {
      form.setFieldsValue({ lecturerName: employee.employeeName, sourceDept: employee.deptName });
    }
  };

  return (
    <Modal
      open={open}
      title={lecturer ? `编辑讲师 ${lecturer.lecturerNo}` : '添加讲师'}
      okText="保存"
      cancelText="取消"
      width={640}
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() =>
        void form
          .validateFields()
          .then((values) => save.mutateAsync(values))
          .catch(() => undefined)
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label="工号"
          name="employeeNo"
          extra="必须已在人员台账中。同一个人只能入池一次——已移出的讲师请改在池状态，不要再建一条"
          rules={[{ required: true, message: '请选择工号' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            disabled={Boolean(lecturer)}
            loading={employees.isLoading}
            onChange={fillFromEmployee}
            options={(employees.data?.records ?? []).map((item) => ({
              value: item.employeeNo,
              label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
            }))}
          />
        </Form.Item>
        <Form.Item label="讲师姓名" name="lecturerName" rules={[{ required: true, message: '请填写讲师姓名' }]}>
          <Input maxLength={50} />
        </Form.Item>
        <Form.Item
          label="来源部门"
          name="sourceDept"
          extra="自由文本，随工号带出后可改。下拉里列的是讲师池里已经出现过的写法，尽量沿用同一种"
          rules={[{ required: true, message: '请填写来源部门' }]}
        >
          <AutoComplete
            options={(sourceDepts.data ?? []).map((value) => ({ value }))}
            filterOption={(input, option) => (option?.value ?? '').includes(input)}
          />
        </Form.Item>
        <Form.Item
          label="擅长领域"
          name="expertiseDomains"
          extra="取自作战单元字典，可多选。字典里没有的领域先去配置中心维护"
          rules={[{ required: true, message: '请至少选择一个擅长领域' }]}
        >
          <Select mode="multiple" options={domains.map((value) => ({ value, label: value }))} />
        </Form.Item>
        <Form.Item
          label="授课方向"
          name="teachingDirection"
          extra="文本描述，如「大模型应用落地、Prompt 工程」"
          rules={[{ required: true, message: '请填写授课方向' }]}
        >
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
        <Form.Item
          label="培养状态"
          name="trainingState"
          extra="可自由改，改动不进状态流转日志。只有「可上岗」的讲师才能被排课"
          rules={[{ required: true, message: '请选择培养状态' }]}
        >
          <Select options={trainingStates} />
        </Form.Item>
        <Form.Item label="在池状态" name="poolState" rules={[{ required: true, message: '请选择在池状态' }]}>
          <Select options={selectOptions(poolStates)} />
        </Form.Item>
        {poolState === poolOut && (
          <Form.Item
            label="移出原因"
            name="removedReason"
            extra="移出保留全部授课与试讲历史，与删除不同"
            rules={[{ required: true, message: '移出讲师池时必须填写移出原因' }]}
          >
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
