import { describe, expect, it } from 'vitest';
import { objectDetailPath } from './objectDetailPath';

describe('objectDetailPath', () => {
  it('按对象类型拼详情深链', () => {
    expect(objectDetailPath('DEMAND', 1)).toBe('/demands/1');
    expect(objectDetailPath('COURSE', 2)).toBe('/courses/2');
    expect(objectDetailPath('TRAINING_PLAN', 3)).toBe('/training-plans/3');
    expect(objectDetailPath('TRAINING_SESSION', 4)).toBe('/training-sessions/4');
    expect(objectDetailPath('LECTURER', 5)).toBe('/lecturers/5');
    expect(objectDetailPath('CASE', 6)).toBe('/cases/6');
  });

  it('未知类型落到任务中心，不回首页', () => {
    expect(objectDetailPath('UNKNOWN', 9)).toBe('/tasks');
  });
});
