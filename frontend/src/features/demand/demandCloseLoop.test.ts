import { describe, expect, it } from 'vitest';
import type { FieldAvailability, ObjectStateView } from '@/shared/api/transitions';
import { nextCloseLoopStep } from './demandCloseLoop';

function field(partial: Partial<FieldAvailability> & Pick<FieldAvailability, 'stateField'>): FieldAvailability {
  return {
    machineName: partial.stateField,
    currentState: null,
    terminal: false,
    allowedActions: [],
    blockedActions: [],
    actions: [],
    ...partial,
  };
}

function view(fields: FieldAvailability[]): ObjectStateView {
  return { objectType: 'DEMAND', objectId: 1, version: 1, fields };
}

describe('nextCloseLoopStep', () => {
  it('没有 available 数据时不猜下一步', () => {
    expect(nextCloseLoopStep(undefined).kind).toBe('blocked');
  });

  it('交付标记已是终态 → 已闭环', () => {
    expect(
      nextCloseLoopStep(
        view([field({ stateField: '需求交付标记', currentState: '已归档', terminal: true })]),
      ),
    ).toEqual({ kind: 'done' });
  });

  it('可归档时优先归档（退出预警）', () => {
    expect(
      nextCloseLoopStep(
        view([
          field({
            stateField: '需求交付标记',
            currentState: '已交付',
            allowedActions: ['归档'],
            actions: [{ action: 'ARCHIVE', label: '归档', toState: '已归档' }],
          }),
        ]),
      ),
    ).toMatchObject({ kind: 'archive', action: 'ARCHIVE' });
  });

  it('待验收时引导去录入结论，而不是直接改状态', () => {
    expect(
      nextCloseLoopStep(
        view([
          field({ stateField: '需求交付标记', currentState: '已交付' }),
          field({
            stateField: '业务验收状态',
            currentState: '待验收',
            allowedActions: ['录入验收结论=通过', '录入验收结论=不通过'],
            actions: [
              { action: 'RECORD_ACCEPTANCE_PASS', label: '录入验收结论=通过', toState: '验收通过' },
              { action: 'RECORD_ACCEPTANCE_REJECT', label: '录入验收结论=不通过', toState: '验收不通过' },
            ],
          }),
        ]),
      ),
    ).toEqual({ kind: 'accept' });
  });

  it('验收不通过时先重新提交', () => {
    expect(
      nextCloseLoopStep(
        view([
          field({ stateField: '需求交付标记', currentState: '已交付' }),
          field({
            stateField: '业务验收状态',
            currentState: '验收不通过',
            allowedActions: ['重新提交验收'],
            actions: [{ action: 'RESUBMIT_ACCEPTANCE', label: '重新提交验收', toState: '待验收' }],
          }),
        ]),
      ),
    ).toMatchObject({ kind: 'resubmit', action: 'RESUBMIT_ACCEPTANCE' });
  });

  it('尚未交付时走标记交付使用', () => {
    expect(
      nextCloseLoopStep(
        view([
          field({
            stateField: '需求交付标记',
            currentState: null,
            allowedActions: ['标记交付使用'],
            actions: [{ action: 'MARK_DELIVERED', label: '标记交付使用', toState: '已交付' }],
          }),
        ]),
      ),
    ).toEqual({ kind: 'deliver' });
  });
});
