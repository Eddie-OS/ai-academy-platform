import { useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Form, Input, Modal, Skeleton, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { DEMAND_OBJECT_TYPE, demandApi, type Demand } from '@/shared/api/demands';
import { allowedAction, fieldOf, transitionApi } from '@/shared/api/transitions';
import { useIsOperator } from '@/shared/store/authStore';
import { PageState } from '@/shared/ui/PageState';
import { neutral, space } from '@/shared/theme/designTokens';
import { DemandAttachments, DEMAND_REF_FIELDS } from './DemandAttachments';
import { DEMAND_STATE_FIELDS, useOutlets } from './demandMeta';

const { Text } = Typography;

/**
 * 详情页「分流与处理」页签（需求 8.3.3）。
 *
 * <p><b>按分流出口决定显示哪一组字段</b>（8.3.3 的界面动态显示规则）：出口为空时字段 21–27 全部
 * 隐藏，出口一显示 21–23，出口二显示 24–27。两组字段同时摆出来的后果是，运营在出口一的需求上
 * 看到一个永远是「—」的「首次上线时间」，然后来问「为什么上线时间不自动填」。
 *
 * <p>状态本身在页头的状态区推进，这里只负责那些<b>要连同业务字段一起写</b>的动作：
 * 「输出解决方案」必须同时给出方案名称（需求 8.3.3 第 22 项：出口一时必填）。
 */

interface DemandOutletTabProps {
  demand: Demand;
}

/** 输出解决方案的动作码，与后端 {@code DemandStateMachines.ACTION_CREATE_SOLUTION} 一致。 */
const ACTION_CREATE_SOLUTION = 'CREATE_SOLUTION';

export function DemandOutletTab({ demand }: DemandOutletTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const outlets = useOutlets();
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ solutionName: string }>();

  const availability = useQuery({
    queryKey: ['demands', demand.id, 'available'],
    queryFn: () => transitionApi.available(DEMAND_OBJECT_TYPE, demand.id),
  });
  const canCreateSolution =
    allowedAction(fieldOf(availability.data, DEMAND_STATE_FIELDS.solution), ACTION_CREATE_SOLUTION) !== null;

  const createSolution = useMutation({
    mutationFn: (values: { solutionName: string }) =>
      demandApi.createSolution(demand.id, values.solutionName, demand.version),
    onSuccess: () => {
      message.success('解决方案已记录，解决方案状态已随之变更');
      setCreating(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  if (!demand.outlet) {
    return (
      <PageState
        variant="empty"
        objectName="分流信息"
        description="这条需求还没有分流出口。出口在「评审信息」页签随评审结论一起录入，录入后这里会显示对应那一组字段。"
      />
    );
  }

  // 出口的取值来自 /api/meta/field-enums，元数据还没到时两个都是 undefined。
  // 此时不猜：显示一组不属于这条需求的字段，比晚一秒显示糟得多
  if (!outlets.solution || !outlets.development) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  if (demand.outlet === outlets.development) {
    return (
      <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="上线时间与优化次数由状态变更自动记账"
          description="首次上线时间只写一次，它是需求处理周期指标的终点；最新上线时间每次上线都会更新；优化次数统计转入优化的次数，不设上限。三者都不可手工修改。"
        />
        <Card size="small" title="需求开发">
          <Descriptions
            column={2}
            size="small"
            styles={{ label: { color: neutral[600], width: 120 } }}
            items={[
              { key: 'outlet', label: '分流出口', children: demand.outlet },
              { key: 'devState', label: '需求开发状态', children: demand.devState ?? '—' },
              { key: 'first', label: '首次上线时间', children: demand.firstOnlineDate ?? '—' },
              { key: 'latest', label: '最新上线时间', children: demand.latestOnlineDate ?? '—' },
              {
                key: 'optimize',
                label: '优化次数',
                children: demand.optimizeCount === null ? '—' : `${demand.optimizeCount} 次`,
              },
            ]}
          />
        </Card>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Card
        size="small"
        title="解决方案"
        extra={
          isOperator &&
          canCreateSolution && (
            <Button type="primary" size="small" onClick={() => setCreating(true)}>
              输出解决方案
            </Button>
          )
        }
      >
        <Descriptions
          column={2}
          size="small"
          styles={{ label: { color: neutral[600], width: 120 } }}
          items={[
            { key: 'outlet', label: '分流出口', children: demand.outlet },
            { key: 'state', label: '解决方案状态', children: demand.solutionState ?? '—' },
            { key: 'name', label: '解决方案名称', span: 2, children: demand.solutionName ?? '—' },
            {
              key: 'files',
              label: '解决方案附件',
              span: 2,
              children: (
                <DemandAttachments
                  demandId={demand.id}
                  refField={DEMAND_REF_FIELDS.solutionFiles}
                  emptyHint="还没有上传解决方案附件"
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        title="输出解决方案"
        okText="保存"
        cancelText="取消"
        confirmLoading={createSolution.isPending}
        onCancel={() => setCreating(false)}
        onOk={() => void form.validateFields().then((values) => createSolution.mutateAsync(values))}
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Text type="secondary">
            方案名称与解决方案状态一起保存。拆成两步会让「有状态但没名称」的需求真实存在于两次请求之间。
          </Text>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              label="解决方案名称"
              name="solutionName"
              rules={[{ required: true, message: '请填写解决方案名称' }]}
            >
              <Input maxLength={200} showCount />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
}
