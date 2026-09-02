import { useEffect } from 'react';
import { Alert, App, Button, Card, DatePicker, Descriptions, Form, Input, Select, Space } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { demandApi, type Demand } from '@/shared/api/demands';
import { invalidateDemandGraph } from '@/shared/query/invalidateGraph';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { DemandAttachments, DEMAND_REF_FIELDS } from './DemandAttachments';
import {
  DEMAND_OBJECT_TYPE_CODE,
  DEMAND_STATE_FIELDS,
  FIELD_ENUM_KEYS,
  selectOptions,
  useFieldEnums,
  useOutlets,
  useStates,
  useTerminalStates,
} from './demandMeta';

/**
 * 详情页「分流与处理」页签（需求 8.3.3）。
 *
 * <p>流转去向只展示两条处理出口。选解决方案或需求开发后出现对应名称／状态／备注。
 * 状态取值来自元数据（纪律 STK-1），保存时后端按转换表推进，不自动连跳。
 */

interface DemandOutletTabProps {
  demand: Demand;
  demo?: boolean;
}

interface ProcessValues {
  outlet: string;
  solutionName?: string;
  solutionState?: string;
  solutionRemark?: string;
  devName?: string;
  devState?: string;
  devRemark?: string;
  expectFinishDate?: Dayjs | null;
  acceptanceState?: string;
  acceptanceRemark?: string;
  deliveryMark?: string;
  deliveryRemark?: string;
  actualFinishDate?: Dayjs | null;
  solutionLink?: string;
}

export function DemandOutletTab({ demand, demo }: DemandOutletTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const outlets = useOutlets();
  const [form] = Form.useForm<ProcessValues>();
  const canEdit = isOperator && !demo;
  const outlet = Form.useWatch('outlet', form);

  const pendingOutput = fieldEnums.data?.[FIELD_ENUM_KEYS.solutionPendingOutput]?.[0];
  const undelivered = fieldEnums.data?.[FIELD_ENUM_KEYS.deliveryUndelivered]?.[0];
  const solutionStates = useStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.solution);
  const devStates = useStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.dev);
  const acceptanceStates = useStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.acceptance);
  const deliveryStates = useStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.deliveryMark);
  const deliveryTerminals = useTerminalStates(DEMAND_OBJECT_TYPE_CODE, DEMAND_STATE_FIELDS.deliveryMark);

  const destinationOptions = [
    outlets.solution && { value: outlets.solution, label: '用工具-输出解决方案' },
    outlets.development && { value: outlets.development, label: '造工具-需求开发' },
  ].filter((item): item is { value: string; label: string } => Boolean(item));

  const deliveryOptions = deliveryFormOptions(
    undelivered ?? '未交付',
    deliveryStates,
    deliveryTerminals,
    demand.deliveryMark,
  );
  const acceptanceOptions = acceptanceFormOptions(acceptanceStates, demand.acceptanceState);
  const savedLink = httpLink(demand.solutionLink);

  useEffect(() => {
    form.setFieldsValue({
      outlet: demand.outlet && demand.outlet !== outlets.reject ? demand.outlet : undefined,
      solutionName: demand.solutionName ?? undefined,
      solutionState: demand.solutionState ?? pendingOutput,
      solutionRemark: demand.solutionRemark ?? undefined,
      devName: demand.devName ?? undefined,
      devState: demand.devState ?? undefined,
      devRemark: demand.devRemark ?? undefined,
      expectFinishDate: demand.expectFinishDate ? dayjs(demand.expectFinishDate) : null,
      acceptanceState: demand.acceptanceState ?? undefined,
      acceptanceRemark: demand.acceptanceRemark ?? undefined,
      deliveryMark: demand.deliveryMark ?? undelivered,
      deliveryRemark: demand.deliveryRemark ?? undefined,
      actualFinishDate: demand.actualFinishDate ? dayjs(demand.actualFinishDate) : null,
      solutionLink: demand.solutionLink ?? undefined,
    });
  }, [
    form,
    demand.id,
    demand.version,
    demand.outlet,
    demand.solutionName,
    demand.solutionState,
    demand.solutionRemark,
    demand.devName,
    demand.devState,
    demand.devRemark,
    demand.expectFinishDate,
    demand.acceptanceState,
    demand.acceptanceRemark,
    demand.deliveryMark,
    demand.deliveryRemark,
    demand.actualFinishDate,
    demand.solutionLink,
    pendingOutput,
    undelivered,
    outlets.reject,
  ]);

  const save = useMutation({
    mutationFn: (values: ProcessValues) =>
      demandApi.saveProcessInfo(demand.id, {
        outlet: values.outlet,
        solutionName: values.solutionName || null,
        solutionState: values.solutionState || null,
        solutionRemark: values.solutionRemark || null,
        devName: values.devName || null,
        devState: values.devState || null,
        devRemark: values.devRemark || null,
        expectFinishDate: values.expectFinishDate?.format('YYYY-MM-DD') ?? null,
        acceptanceState: values.acceptanceState || null,
        acceptanceRemark: values.acceptanceRemark || null,
        deliveryMark: values.deliveryMark || null,
        deliveryRemark: values.deliveryRemark || null,
        actualFinishDate: values.actualFinishDate?.format('YYYY-MM-DD') ?? null,
        solutionLink: values.solutionLink || null,
        version: demand.version,
      }),
    onSuccess: () => {
      message.success('分流与处理已保存');
      invalidateDemandGraph(queryClient);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  if (outlets.reject && demand.outlet === outlets.reject) {
    return (
      <Card size="small" title="需求驳回">
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'outlet', label: '流转去向', children: demand.outlet },
            { key: 'state', label: '处理状态', children: demand.currentProcessState ?? '—' },
          ]}
        />
      </Card>
    );
  }

  const isSolution = Boolean(outlets.solution && outlet === outlets.solution);
  const isDevelopment = Boolean(outlets.development && outlet === outlets.development);

  return (
    <Space className="dmd-process-form" direction="vertical" size={space.md} style={{ width: '100%' }}>
      {demo && (
        <Alert
          type="info"
          showIcon
          message="演示数据不能保存分流与处理"
          description="请先「新建需求」或打开已落库的需求，再在此页填写。"
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark
        disabled={!canEdit}
        onFinish={(values) => {
          if (demo) {
            message.info('演示数据无法保存，请先「新建需求」');
            return;
          }
          void save.mutateAsync(values);
        }}
      >
        <Form.Item
          className="dmd-form-wide"
          label="流转去向"
          name="outlet"
          extra="与评审结论对应的两条处理出口。"
          rules={[{ required: true, message: '请选择流转去向' }]}
        >
          <Select showSearch optionFilterProp="label" options={destinationOptions} placeholder="请选择流转去向" />
        </Form.Item>

        {isSolution && (
          <>
            <Form.Item
              label="解决方案名称"
              name="solutionName"
              rules={[{ required: true, message: '请填写解决方案名称' }]}
            >
              <Input maxLength={200} showCount />
            </Form.Item>
            <Form.Item label="解决方案状态" name="solutionState">
              <Select
                showSearch
                optionFilterProp="label"
                options={selectOptions([pendingOutput, ...solutionStates].filter((item): item is string => Boolean(item)))}
                placeholder="请选择解决方案状态"
              />
            </Form.Item>
            <Form.Item label="解决方案备注" name="solutionRemark">
              <Input.TextArea rows={3} autoSize={{ minRows: 2 }} />
            </Form.Item>
          </>
        )}

        {isDevelopment && (
          <>
            <Form.Item
              label="需求开发名称"
              name="devName"
              rules={[{ required: true, message: '请填写需求开发名称' }]}
            >
              <Input maxLength={200} showCount />
            </Form.Item>
            <Form.Item label="需求开发状态" name="devState">
              <Select
                showSearch
                optionFilterProp="label"
                options={selectOptions(devStates)}
                placeholder="请选择需求开发状态"
              />
            </Form.Item>
            <Form.Item label="开发备注" name="devRemark">
              <Input.TextArea rows={3} autoSize={{ minRows: 2 }} />
            </Form.Item>
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'first', label: '首次上线时间', children: demand.firstOnlineDate ?? '—' },
                { key: 'latest', label: '最新上线时间', children: demand.latestOnlineDate ?? '—' },
                {
                  key: 'optimize',
                  label: '优化次数',
                  children: demand.optimizeCount === null || demand.optimizeCount === undefined
                    ? '—'
                    : `${demand.optimizeCount} 次`,
                },
              ]}
            />
          </>
        )}

        <Form.Item label="预计完成时间" name="expectFinishDate">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="业务验收状态"
          name="acceptanceState"
          extra="「已验收」请到「业务验收」页签录入结论（须填验收人）"
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={acceptanceOptions}
            placeholder="请选择业务验收状态"
          />
        </Form.Item>
        <Form.Item label="验收备注" name="acceptanceRemark">
          <Input.TextArea rows={2} autoSize={{ minRows: 2 }} />
        </Form.Item>
        <Form.Item label="交付使用状态" name="deliveryMark">
          <Select
            showSearch
            optionFilterProp="label"
            options={deliveryOptions}
            placeholder="请选择交付使用状态"
          />
        </Form.Item>
        <Form.Item label="实际完成时间" name="actualFinishDate">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="交付备注" name="deliveryRemark">
          <Input.TextArea rows={2} autoSize={{ minRows: 2 }} />
        </Form.Item>
        <Form.Item
          label="关联解决方案"
          name="solutionLink"
          extra="填写 http:// 或 https:// 开头的链接，保存后可点击跳转"
        >
          <Input placeholder="https://" />
        </Form.Item>
        {savedLink && (
          <p className="dmd-solution-link">
            <a href={savedLink} target="_blank" rel="noopener noreferrer">
              {savedLink}
            </a>
          </p>
        )}

        {canEdit && (
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              保存
            </Button>
          </Form.Item>
        )}
      </Form>

      {isSolution && !demo && (
        <DemandAttachments
          demandId={demand.id}
          refField={DEMAND_REF_FIELDS.solutionFiles}
          emptyHint="还没有上传解决方案附件"
        />
      )}
    </Space>
  );
}

/**
 * 交付使用状态下拉。终态不进选项——归档是退出预警的动作，得走「闭环」按钮走转换接口，
 * 在这张表单里直接选中会绕过验收前置（C9）。终态由后端转换表算出，这里不列举状态名。
 */
function deliveryFormOptions(
  undelivered: string | undefined,
  states: string[],
  terminalStates: string[],
  current: string | null | undefined,
) {
  const values = [undelivered, ...states.filter((item) => !terminalStates.includes(item))].filter(
    (item): item is string => Boolean(item),
  );
  if (current && !values.includes(current)) {
    values.push(current);
  }
  return selectOptions(values);
}

/**
 * 业务验收状态下拉里「通过」的下标。
 *
 * <p>下发顺序即后端 {@code DemandStateMachines} 的定义顺序，通过之后才是「不通过」。
 * 表单只放到「通过」为止：不通过必须连着结论与验收人一起录，入口在「业务验收」页签。
 */
const ACCEPTANCE_PASSED_INDEX = 2;

/** 需求 8.3.3 的展示名。它不是状态值——状态值是下发数组里的那一项，这里只换标签。 */
const ACCEPTANCE_PASSED_LABEL = '已验收';

function acceptanceFormOptions(states: string[], current: string | null | undefined) {
  const passed = states[ACCEPTANCE_PASSED_INDEX];
  const options = states
    .slice(0, ACCEPTANCE_PASSED_INDEX + 1)
    .map((value) => ({ value, label: value === passed ? ACCEPTANCE_PASSED_LABEL : value }));
  if (current && !options.some((item) => item.value === current)) {
    options.push({ value: current, label: current === passed ? ACCEPTANCE_PASSED_LABEL : current });
  }
  return options;
}

function httpLink(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://') ? value : null;
}
