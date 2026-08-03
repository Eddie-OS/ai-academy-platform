import { useEffect } from 'react';
import { App, DatePicker, Form, Input, Modal, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { caseApi, type CaseForm, type CaseInfo } from '@/shared/api/cases';
import { FIELD_ENUM_KEYS, selectOptions, useCaseDomains, useEmployees, useFieldEnums } from './caseMeta';

/**
 * 编辑案例（需求 12.3 的可编辑字段）。
 *
 * <p><b>只有编辑，没有新建。</b>案例由课程标注达精品时自动创建（议题 27），运营改的是那条
 * 自动记录里几个取自课程的初值。
 *
 * <p><b>表单里没有案例状态、没有审核四字段、没有上架时间。</b>状态走转换接口，审核结论走
 * 「审核」入口——把它们做成可填字段，就能存出一条「已上架但没有审核人」的案例，而 C9 把
 * 「上架前必须审核通过」列为三处硬阻断之一。
 *
 * <p><b>正文不在这里改。</b>正文是富文本、篇幅长，挤在弹窗里没法写，它在详情面板的
 * 「正文」页签里编辑。这里带上它只是为了保存时不把已有正文清空——后端的 update 是整体覆盖。
 */

interface CaseFormModalProps {
  open: boolean;
  caseInfo: CaseInfo;
  onClose: () => void;
  onUpdated: () => void;
}

interface FormValues {
  caseName: string;
  contributingOrg: string;
  contributors: string[];
  domainCodes: string[];
  ownerNo: string;
  qualityMarks: string[];
  expectPublishDate?: dayjs.Dayjs | null;
}

export function CaseFormModal({ open, caseInfo, onClose, onUpdated }: CaseFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const employees = useEmployees();
  const domains = useCaseDomains();
  const fieldEnums = useFieldEnums();

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      caseName: caseInfo.caseName,
      contributingOrg: caseInfo.contributingOrg,
      contributors: caseInfo.contributors,
      domainCodes: caseInfo.domainCodes,
      ownerNo: caseInfo.ownerNo,
      qualityMarks: caseInfo.qualityMarks,
      expectPublishDate: caseInfo.expectPublishDate ? dayjs(caseInfo.expectPublishDate) : null,
    });
  }, [open, caseInfo, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CaseForm = {
        caseName: values.caseName,
        contributingOrg: values.contributingOrg,
        contributors: values.contributors ?? [],
        domainCodes: values.domainCodes,
        ownerNo: values.ownerNo,
        qualityMarks: values.qualityMarks ?? [],
        content: caseInfo.content,
        expectPublishDate: values.expectPublishDate
          ? values.expectPublishDate.format('YYYY-MM-DD')
          : null,
      };
      return caseApi.update(caseInfo.id, payload, caseInfo.version);
    },
    onSuccess: () => {
      message.success('案例信息已保存');
      onUpdated();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const employeeOptions = (employees.data?.records ?? []).map((item) => ({
    value: item.employeeNo,
    label: `${item.employeeName}（${item.employeeNo}·${item.deptName}·${item.personState}）`,
  }));

  return (
    <Modal
      open={open}
      title={`编辑案例 ${caseInfo.caseNo}`}
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
          label="案例名称"
          name="caseName"
          extra="初值取自来源课程的名称，可改成更贴近案例内容的说法"
          rules={[{ required: true, message: '请填写案例名称' }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item
          label="贡献组织"
          name="contributingOrg"
          extra="自由文本。初值取自案例负责人所在部门，写「待补充」的需要在这里补上"
          rules={[{ required: true, message: '请填写贡献组织' }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item label="贡献人" name="contributors" extra="可多选，可留空">
          <Select mode="multiple" showSearch optionFilterProp="label" options={employeeOptions} />
        </Form.Item>
        <Form.Item
          label="应用领域"
          name="domainCodes"
          extra="取自作战单元字典，可多选。初值是来源课程的所属领域"
          rules={[{ required: true, message: '请至少选择一个应用领域' }]}
        >
          <Select
            mode="multiple"
            options={domains.map((item) => ({ value: item.code, label: item.name }))}
          />
        </Form.Item>
        <Form.Item
          label="案例负责人"
          name="ownerNo"
          extra="负责人只是「找谁问」的线索，不决定谁能改这条案例——运营账号都能改"
          rules={[{ required: true, message: '请选择案例负责人' }]}
        >
          <Select showSearch optionFilterProp="label" loading={employees.isLoading} options={employeeOptions} />
        </Form.Item>
        <Form.Item
          label="精品标注"
          name="qualityMarks"
          extra="由线下评审决定后在这里标注，可多选。平台不做任何价值评估"
        >
          <Select
            mode="multiple"
            options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.caseQualityMark])}
          />
        </Form.Item>
        <Form.Item label="预计上架日期" name="expectPublishDate">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
