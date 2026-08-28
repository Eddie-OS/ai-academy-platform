import { allowedAction, blockedReason, fieldOf, type ObjectStateView } from '@/shared/api/transitions';
import { DEMAND_STATE_FIELDS } from './demandMeta';

/**
 * 需求闭环的下一步（交付 → 验收 → 归档）。
 *
 * <p>归档是退出预警的唯一出口（{@code delivery_mark = 已归档} → 灯色 NONE）。
 * 列表里没有这条通路时，预计完成日一过、或状态超过红灯阈值未变，灯就会全变成红——
 * 前端再把成因兜成「逾期」，看起来就像「时间一过全是逾期」。
 *
 * <p>动作码与 {@code DemandStateMachines.ACTION_*} 对齐；显隐仍以 available 接口为准，
 * 这里只决定「闭环」这一颗按钮该走哪一步，不另写一套状态推断。
 */

export const CLOSE_LOOP_ACTION = {
  archive: 'ARCHIVE',
  markDelivered: 'MARK_DELIVERED',
  recordPass: 'RECORD_ACCEPTANCE_PASS',
  recordReject: 'RECORD_ACCEPTANCE_REJECT',
  resubmit: 'RESUBMIT_ACCEPTANCE',
} as const;

export type CloseLoopStep =
  | { kind: 'done' }
  | { kind: 'archive'; field: string; action: string; label: string }
  | { kind: 'deliver' }
  | { kind: 'accept' }
  | { kind: 'resubmit'; field: string; action: string; label: string }
  | { kind: 'blocked'; reason: string };

const BLOCKED_HINT =
  '当前还不能闭环。请先走完评审与分流处理，再标记交付、录入验收并通过后归档。归档后才会退出预警。';

export function nextCloseLoopStep(view: ObjectStateView | undefined): CloseLoopStep {
  if (!view) {
    return { kind: 'blocked', reason: '还没有取到这条需求的可执行动作，请稍后重试' };
  }

  const delivery = fieldOf(view, DEMAND_STATE_FIELDS.deliveryMark);
  const acceptance = fieldOf(view, DEMAND_STATE_FIELDS.acceptance);

  if (delivery?.terminal) {
    return { kind: 'done' };
  }

  const archive = allowedAction(delivery, CLOSE_LOOP_ACTION.archive);
  if (archive) {
    return {
      kind: 'archive',
      field: DEMAND_STATE_FIELDS.deliveryMark,
      action: archive.action,
      label: archive.label,
    };
  }

  if (
    allowedAction(acceptance, CLOSE_LOOP_ACTION.recordPass) ||
    allowedAction(acceptance, CLOSE_LOOP_ACTION.recordReject)
  ) {
    return { kind: 'accept' };
  }

  const resubmit = allowedAction(acceptance, CLOSE_LOOP_ACTION.resubmit);
  if (resubmit) {
    return {
      kind: 'resubmit',
      field: DEMAND_STATE_FIELDS.acceptance,
      action: resubmit.action,
      label: resubmit.label,
    };
  }

  if (allowedAction(delivery, CLOSE_LOOP_ACTION.markDelivered)) {
    return { kind: 'deliver' };
  }

  return {
    kind: 'blocked',
    reason:
      blockedReason(delivery, CLOSE_LOOP_ACTION.markDelivered)
      ?? blockedReason(delivery, CLOSE_LOOP_ACTION.archive)
      ?? blockedReason(acceptance, CLOSE_LOOP_ACTION.recordPass)
      ?? BLOCKED_HINT,
  };
}
