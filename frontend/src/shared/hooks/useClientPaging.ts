import { useMemo, useState } from 'react';

/**
 * 前端分页。
 *
 * <p>只给配置中心这类「一次全量返回、总量在两位数」的列表用：阈值 4 行、派生规则 10 行、
 * 自检题库 14 行、字典项几十行。给它们做后端分页反而更差——运营改一条字典项要能看到全表的
 * 排序号，翻页会把这件事变难。
 *
 * <p><b>业务列表不要用这个 hook。</b>课程、需求、签到这些表三年后是十万行量级，
 * 必须走后端分页（API-6）。
 */
export function useClientPaging<T>(rows: T[] | undefined, defaultPageSize = 20) {
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const paged = useMemo(
    () => (rows ?? []).slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [rows, pageNum, pageSize],
  );

  return {
    pageNum,
    pageSize,
    rows: paged,
    total: rows?.length ?? 0,
    onPageChange: (nextPage: number, nextSize: number) => {
      setPageNum(nextPage);
      setPageSize(nextSize);
    },
    resetPage: () => setPageNum(1),
  };
}
