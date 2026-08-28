import { useState } from 'react';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { DEMAND_OBJECT_TYPE, demandApi, type Demand } from '@/shared/api/demands';
import { transitionApi } from '@/shared/api/transitions';
import { invalidateDemandGraph } from '@/shared/query/invalidateGraph';
import { nextCloseLoopStep } from './demandCloseLoop';

/**
 * 需求列表／详情共用的「闭环」入口。
 *
 * <p>一次点击只走闭环主线上的<b>下一步</b>：标记交付、录入验收、重新提交验收、归档。
 * 不自动连跳——状态一律手动变更（C1），归档还带着验收通过前置（C9）。
 */

interface UseDemandCloseLoopOptions {
  /** 下一步是录入验收结论时：打开业务验收页签，由页签里的表单承接 */
  onNeedAcceptance: (demand: Demand) => void;
}

export function useDemandCloseLoop({ onNeedAcceptance }: UseDemandCloseLoopOptions) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const refresh = () => invalidateDemandGraph(queryClient);

  const run = async (demand: Demand) => {
    setPendingId(demand.id);
    try {
      const view = await transitionApi.available(DEMAND_OBJECT_TYPE, demand.id);
      const step = nextCloseLoopStep(view);

      if (step.kind === 'done') {
        message.info('这条需求的闭环已经走完，已退出预警，灯色为无灯');
        return;
      }
      if (step.kind === 'blocked') {
        message.warning(step.reason);
        return;
      }
      if (step.kind === 'accept') {
        onNeedAcceptance(demand);
        message.info('请在「业务验收」页签录入验收结论。通过后即可归档退出预警');
        return;
      }
      if (step.kind === 'deliver') {
        modal.confirm({
          title: '标记交付使用',
          content: demand.outlet
            ? '将同时进入业务验收。验收结论为通过后再点一次「闭环」即可归档，归档后红灯才会消失。'
            : '这条需求还没有分流出口。标记交付不校验评审是否完成（C9），但仍建议先录入评审结论。交付后进入业务验收。',
          okText: '标记交付',
          cancelText: '取消',
          onOk: async () => {
            await demandApi.markDelivered(demand.id, demand.version);
            message.success('已标记交付使用，需求同时进入业务验收');
            refresh();
          },
        });
        return;
      }
      if (step.kind === 'resubmit') {
        modal.confirm({
          title: step.label,
          content: '上一轮验收未通过。重新提交后才能再录结论；通过后才可归档退出预警。',
          okText: '重新提交',
          cancelText: '取消',
          onOk: async () => {
            await transitionApi.transit(DEMAND_OBJECT_TYPE, demand.id, {
              stateField: step.field,
              action: step.action,
              version: demand.version,
            });
            message.success('已重新提交验收');
            refresh();
          },
        });
        return;
      }

      modal.confirm({
        title: step.label,
        content: '归档后这条需求退出预警范围，灯色变为无灯。验收未通过时归档会被拒绝。',
        okText: '归档',
        cancelText: '取消',
        onOk: async () => {
          await transitionApi.transit(DEMAND_OBJECT_TYPE, demand.id, {
            stateField: step.field,
            action: step.action,
            version: demand.version,
          });
          message.success('归档完成，该需求退出预警');
          refresh();
        },
      });
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '闭环操作失败，请重试');
    } finally {
      setPendingId(null);
    }
  };

  return { run, pendingId };
}
