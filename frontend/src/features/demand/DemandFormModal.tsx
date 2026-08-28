import { useEffect } from 'react';
import { App, Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { demandApi, type Demand, type DemandForm } from '@/shared/api/demands';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { DemandAttachments, DEMAND_REF_FIELDS } from './DemandAttachments';
import { selectOptions, useDemandDomains, useFieldEnums } from './demandMeta';
import './demandFormModal.css';

/**
 * 需求登记与基本信息编辑（需求 8.3.1 + 现场口径 D-21）。
 *
 * <p>登记与编辑共用一张表单：可编辑字段完全相同，拆成两个组件必然出现「新建能填、编辑填不了」
 * 的字段差异。
 *
 * <p>所属领域最后一项「手动输入」是表单哨兵，不入库。提出人／负责人均手填，负责人可多人。
 *
 * <p>预计开发完成时间仍保留：三色灯按自然日判定，去掉它预警会失效。
 *
 * <p>编辑时必须回传 {@code version}（规则 K1）。
 */

/** 表单哨兵：选中后出现手填框，本身不作为 domainCode 提交。 */
const DOMAIN_MANUAL = '手动输入';

const DESCRIPTION_HINT = `【背景】当前业务痛点或机会是什么？
【目标】希望达成什么结果？
【要求】范围、约束、验收口径？`;

const ATTACHMENT_ACCEPT = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';

interface DemandFormModalProps {
  open: boolean;
  /** 传入即为编辑，不传为登记 */
  demand?: Demand;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onUpdated?: () => void;
}

interface FormValues {
  demandName: string;
  domainPick: string;
  domainCustom?: string;
  proposerNo: string;
  ownerNameList: string[];
  proposedDate: Dayjs;
  expectFinishDate: Dayjs;
  description: string;
  demandSource?: string | null;
  demandType?: string | null;
  priority?: string | null;
  businessBackground: string;
  roiAnalysis: string;
  remark?: string | null;
}

function splitOwners(demand: Demand): string[] {
  const raw = demand.ownerNames?.trim() || demand.ownerName || demand.ownerNo;
  return raw
    .split(/[、,，]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function knownDomain(code: string, presets: string[]): boolean {
  return presets.includes(code);
}

export function DemandFormModal({ open, demand, onClose, onCreated, onUpdated }: DemandFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const domainPresets = useDemandDomains();
  const domainPick = Form.useWatch('domainPick', form);
  const manualDomain = domainPick === DOMAIN_MANUAL;

  useEffect(() => {
    if (!open || demand) {
      return;
    }
    form.resetFields();
    form.setFieldsValue({ proposedDate: dayjs(), ownerNameList: [] });
  }, [open, demand, form]);

  useEffect(() => {
    if (!open || !demand) {
      return;
    }
    const isPreset = knownDomain(demand.domainCode, domainPresets);
    form.setFieldsValue({
      demandName: demand.demandName,
      domainPick: isPreset ? demand.domainCode : DOMAIN_MANUAL,
      domainCustom: isPreset ? undefined : demand.domainCode,
      proposerNo: demand.proposerName ?? demand.proposerNo,
      ownerNameList: splitOwners(demand),
      proposedDate: dayjs(demand.proposedDate),
      expectFinishDate: dayjs(demand.expectFinishDate),
      description: demand.description,
      demandSource: demand.demandSource,
      demandType: demand.demandType,
      priority: demand.priority,
      businessBackground: demand.businessBackground ?? undefined,
      roiAnalysis: demand.roiAnalysis ?? undefined,
      remark: demand.remark ?? undefined,
    });
  }, [open, demand, form, domainPresets]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const owners = (values.ownerNameList ?? []).map((name) => name.trim()).filter(Boolean);
      const firstOwner = owners[0];
      if (!firstOwner) {
        throw new Error('请填写至少一名需求负责人');
      }
      const domainCode =
        values.domainPick === DOMAIN_MANUAL ? (values.domainCustom ?? '').trim() : values.domainPick;
      const payload: DemandForm = {
        demandName: values.demandName.trim(),
        domainCode,
        proposerNo: values.proposerNo.trim(),
        ownerNo: firstOwner,
        ownerNames: owners.join('、'),
        proposedDate: values.proposedDate.format('YYYY-MM-DD'),
        expectFinishDate: values.expectFinishDate.format('YYYY-MM-DD'),
        description: values.description,
        demandSource: values.demandSource,
        demandType: values.demandType,
        priority: values.priority,
        businessBackground: values.businessBackground,
        roiAnalysis: values.roiAnalysis,
        remark: values.remark,
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

  const domainOptions = [
    ...selectOptions(domainPresets),
    { value: DOMAIN_MANUAL, label: DOMAIN_MANUAL },
  ];

  return (
    <Modal
      open={open}
      title={demand ? `编辑需求 ${demand.demandNo}` : '登记需求'}
      okText="保存"
      cancelText="取消"
      width={1120}
      centered
      zIndex={1100}
      className="demand-form-modal"
      destroyOnHidden
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() => {
        void form.validateFields().then((values) => save.mutateAsync(values));
      }}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="需求ID" extra="唯一标识，保存后由系统按 XQ + 年月 + 流水自动生成">
              <Input value={demand?.demandNo ?? '保存后自动生成'} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="需求名称"
              name="demandName"
              rules={[{ required: true, message: '请填写需求名称' }]}
            >
              <Input maxLength={100} showCount placeholder="请输入需求名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="需求所属领域"
              name="domainPick"
              rules={[{ required: true, message: '请选择所属领域' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={domainOptions}
                placeholder="请选择所属领域"
              />
            </Form.Item>
            {manualDomain && (
              <Form.Item
                name="domainCustom"
                rules={[{ required: true, message: '请填写所属领域' }]}
              >
                <Input maxLength={64} showCount placeholder="请输入所属领域" />
              </Form.Item>
            )}
          </Col>
          <Col span={12}>
            <Form.Item
              label="需求提出人"
              name="proposerNo"
              extra="手工录入提出人姓名"
              rules={[{ required: true, message: '请填写需求提出人' }]}
            >
              <Input maxLength={50} placeholder="请输入提出人姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="需求提出时间"
              name="proposedDate"
              extra="按自然日记录，支持日历选择"
              rules={[{ required: true, message: '请填写提出时间' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="预计开发完成时间"
              name="expectFinishDate"
              extra="三色灯按它判定「正常运行／需要关注／已逾期」"
              rules={[{ required: true, message: '请填写预计开发完成时间' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="需求负责人"
              name="ownerNameList"
              extra="输入姓名后回车，可录入多人"
              rules={[{ required: true, type: 'array', min: 1, message: '请填写至少一名需求负责人' }]}
            >
              <Select
                mode="tags"
                tokenSeparators={[',', '，', '、']}
                placeholder="输入姓名后回车"
                open={false}
                suffixIcon={null}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="需求优先级"
              name="priority"
              extra="只用于列表排序与筛选，不驱动任何自动逻辑"
              rules={[{ required: true, message: '请选择优先级' }]}
            >
              <Select
                options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandPriority])}
                placeholder="请选择优先级"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="需求描述"
              name="description"
              extra="选中输入框后提示词会消失，请按背景、目标、要求手工填写"
              rules={[{ required: true, message: '请填写需求描述' }]}
            >
              <Input.TextArea
                rows={5}
                maxLength={2000}
                showCount
                placeholder={DESCRIPTION_HINT}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="业务背景"
              name="businessBackground"
              extra="描述当前痛点、用户场景或业务机会"
              rules={[{ required: true, message: '请填写业务背景' }]}
            >
              <Input.TextArea rows={3} maxLength={2000} showCount placeholder="请描述当前痛点、用户场景或业务机会" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="ROI分析"
              name="roiAnalysis"
              extra="量化或定性描述均可；一期不做自动测算"
              rules={[{ required: true, message: '请填写 ROI 分析' }]}
            >
              <Input.TextArea rows={3} maxLength={2000} showCount placeholder="请量化或定性描述预期收益与投入" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="需求来源" name="demandSource">
              <Select allowClear options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandSource])} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="需求类型" name="demandType">
              <Select allowClear options={selectOptions(fieldEnums.data?.[FIELD_ENUM_KEYS.demandType])} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="附件上传" extra={demand ? undefined : '请先保存需求，再回来上传图片、文档或视频'}>
              {demand ? (
                <DemandAttachments
                  demandId={demand.id}
                  refField={DEMAND_REF_FIELDS.extras}
                  emptyHint="可上传图片、文档、视频等补充材料"
                  accept={ATTACHMENT_ACCEPT}
                />
              ) : (
                <Input disabled placeholder="保存后再上传图片、文档或视频" />
              )}
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="备注" name="remark" extra="其他非结构化但重要的补充说明">
              <Input.TextArea rows={3} maxLength={2000} showCount placeholder="选填" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
