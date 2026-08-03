import { describe, expect, it } from 'vitest';
import {
  actionTo,
  allowedAction,
  blockedReason,
  fieldOf,
  type FieldAvailability,
  type ObjectStateView,
} from './transitions';

/**
 * 状态地图拖动的合法性判定（需求 9.2：卡片可拖动<b>仅在合法转换范围内</b>生效）。
 *
 * <p>这些用例盯的是同一件事：<b>「转换表里有这条边」不等于「现在可以走」。</b>
 * 一条从「优化」出发的转换，对一门处在「立项」的课程来说是不可执行的，而它同样出现在
 * 状态机定义里。只看目标状态匹配就放行，运营拖动后拿到的是 ILLEGAL_TRANSITION——
 * 一次本可以避免的失败操作。
 */

function field(overrides: Partial<FieldAvailability> = {}): FieldAvailability {
  return {
    stateField: '课程主状态',
    machineName: '课程主状态',
    currentState: '立项',
    terminal: false,
    allowedActions: ['开始开发', '关闭课程开发'],
    blockedActions: [{ action: '提交评审', reason: '当前状态为「立项」，不允许执行「提交评审」' }],
    actions: [
      { action: 'START_DEVELOP', label: '开始开发', toState: '开发' },
      { action: 'CLOSE_DEVELOPMENT', label: '关闭课程开发', toState: '已关闭' },
      // 转换表里存在但当前状态走不到：从「自检」出发才有这条边
      { action: 'SUBMIT_REVIEW', label: '提交评审', toState: '评审决策' },
    ],
    ...overrides,
  };
}

describe('actionTo（拖动到目标状态时找可执行动作）', () => {
  it('目标状态可达且动作在 allowedActions 里，返回该动作', () => {
    expect(actionTo(field(), '开发')?.action).toBe('START_DEVELOP');
  });

  it('目标状态在转换表里但当前状态走不到，返回 null——不能只看目标状态匹配', () => {
    expect(actionTo(field(), '评审决策')).toBeNull();
  });

  it('转换表里根本没有的目标状态返回 null', () => {
    expect(actionTo(field(), '精品案例')).toBeNull();
  });

  it('可用性还没加载出来时返回 null，而不是先当成可执行', () => {
    expect(actionTo(undefined, '开发')).toBeNull();
  });
});

describe('allowedAction（录入类页签决定录入入口显不显示）', () => {
  it('动作码在表里且当前可执行，返回该动作', () => {
    expect(allowedAction(field(), 'START_DEVELOP')?.label).toBe('开始开发');
  });

  it('动作码在表里但当前走不到，返回 null——录入入口不能只看「这个动作存在」', () => {
    expect(allowedAction(field(), 'SUBMIT_REVIEW')).toBeNull();
  });

  it('可用性还没加载出来时返回 null，此时不渲染录入入口', () => {
    expect(allowedAction(undefined, 'START_DEVELOP')).toBeNull();
  });
});

describe('blockedReason（置灰时要说得出原因）', () => {
  it('被状态挡住的动作给出后端写的原因', () => {
    expect(blockedReason(field(), 'SUBMIT_REVIEW')).toBe('当前状态为「立项」，不允许执行「提交评审」');
  });

  it('当前可执行的动作没有原因', () => {
    expect(blockedReason(field(), 'START_DEVELOP')).toBeNull();
  });

  it('后端根本没提到的动作返回 null——这种动作不该被渲染，更不该编一个原因', () => {
    expect(blockedReason(field(), 'ARCHIVE')).toBeNull();
  });
});

describe('fieldOf（在多个状态字段里定位）', () => {
  const view: ObjectStateView = {
    objectType: 'COURSE',
    objectId: 7,
    version: 3,
    fields: [field(), field({ stateField: '试讲状态', currentState: '待试讲', actions: [], allowedActions: [] })],
  };

  it('按状态字段名取到对应的那一组动作', () => {
    expect(fieldOf(view, '试讲状态')?.currentState).toBe('待试讲');
  });

  it('取不到的字段返回 undefined，由调用方决定不渲染', () => {
    expect(fieldOf(view, '课程发布状态')).toBeUndefined();
    expect(fieldOf(undefined, '课程主状态')).toBeUndefined();
  });
});
