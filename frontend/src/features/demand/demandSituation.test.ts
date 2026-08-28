import { describe, expect, it } from 'vitest';
import {
  countByStates,
  devStateOf,
  shareOf,
  sliceTotal,
  solutionBucketOf,
} from './demandSituation';

describe('需求态势图切片', () => {
  it('占比保留一位小数，分母为 0 时是 0.0%', () => {
    expect(shareOf(1, 4)).toBe('25.0%');
    expect(shareOf(0, 0)).toBe('0.0%');
    expect(shareOf(4, 4)).toBe('100.0%');
  });

  it('按给定档位计数，空档保留 0', () => {
    const rows = [{ state: '待评审' }, { state: '已评审' }, { state: '已评审' }];
    expect(countByStates(rows, ['待评审', '评审中', '已评审'], (row) => row.state)).toEqual([
      { state: '待评审', value: 1 },
      { state: '评审中', value: 0 },
      { state: '已评审', value: 2 },
    ]);
    expect(sliceTotal(countByStates(rows, ['待评审', '已评审'], (row) => row.state))).toBe(3);
  });

  it('解决方案空态记入待输出，开发出口才计入开发档', () => {
    const pending = '待输出';
    expect(
      solutionBucketOf({ outlet: 'SOLUTION', solutionState: null }, pending, '用现有工具输出解决方案'),
    ).toBe(pending);
    expect(
      solutionBucketOf({ outlet: '用现有工具输出解决方案', solutionState: '已发布' }, pending, '用现有工具输出解决方案'),
    ).toBe('已发布');
    expect(solutionBucketOf({ outlet: 'DEVELOP', solutionState: null }, pending)).toBeNull();
    expect(devStateOf({ outlet: 'DEVELOP', currentState: '开发中' })).toBe('开发中');
    expect(devStateOf({ outlet: 'SOLUTION', currentState: '已发布' })).toBeNull();
  });
});
