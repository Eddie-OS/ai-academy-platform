/**
 * 需求态势图三张切片：评审 / 解决方案 / 开发。
 *
 * <p>档位顺序取状态机与字段枚举（纪律 STK-1），不在这里手写状态值列表。
 * 占比按<b>本图合计</b>算，三张各自加总为 100.0%。
 */

export interface SituationSlice {
  state: string;
  value: number;
}

export function shareOf(value: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function sliceTotal(items: ReadonlyArray<SituationSlice>): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

export function countByStates<T>(
  rows: readonly T[],
  states: readonly string[],
  pick: (row: T) => string | null | undefined,
): SituationSlice[] {
  return states.map((state) => ({
    state,
    value: rows.filter((row) => pick(row) === state).length,
  }));
}

export function solutionBucketOf(
  row: {
    solutionState?: string | null;
    outlet?: string | null;
    currentState?: string | null;
    currentProcessState?: string | null;
  },
  pendingOutput: string | undefined,
  solutionOutlet?: string,
): string | null {
  if (row.solutionState) return row.solutionState;
  const outlet = row.outlet ?? '';
  const onSolution =
    outlet === 'SOLUTION' || (solutionOutlet != null && outlet === solutionOutlet);
  if (onSolution) {
    return row.currentState || row.currentProcessState || pendingOutput || null;
  }
  return null;
}

export function devStateOf(
  row: {
    devState?: string | null;
    outlet?: string | null;
    currentState?: string | null;
    currentProcessState?: string | null;
  },
  developmentOutlet?: string,
): string | null {
  if (row.devState) return row.devState;
  const outlet = row.outlet ?? '';
  const onDev = outlet === 'DEVELOP' || (developmentOutlet != null && outlet === developmentOutlet);
  if (onDev) {
    return row.currentState || row.currentProcessState || null;
  }
  return null;
}
