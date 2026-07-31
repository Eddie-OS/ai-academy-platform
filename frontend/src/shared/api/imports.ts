import { api, query } from './client';
import type { PageResult } from './types';

/**
 * 导入中心接口（需求 13.8）。
 *
 * <p><b>类型定义暂由手写，这是一处已知偏离纪律 STK-1 的地方。</b>STK-1 要求 client 与
 * 枚举由 OpenAPI 生成，后端 springdoc 已就绪，但生成器（openapi-typescript）无法在
 * 当前离线环境安装。因此本文件按后端 record 逐字段对齐，且<b>不在前端写任何枚举字面量</b>——
 * 导入类型、导入结果这些取值全部来自 {@link importApi.types} 与批次数据本身。
 * 该偏离已记入待办，网络可用后用生成代码替换本文件的 interface 部分。
 */

export interface ImportTypeOption {
  /** 路径用的小写连字符名，如 `training-feedback` */
  code: string;
  label: string;
  templateFileName: string;
  /** 追加语义（规则 I9）：只新增不更新，因此 updateRows 恒为 0 */
  appendOnly: boolean;
}

export interface ImportBatch {
  id: number;
  batchNo: string;
  importType: string;
  fileName: string;
  totalRows: number | null;
  insertRows: number | null;
  updateRows: number | null;
  batchState: string;
  importResult: string | null;
  errorReportPath: string | null;
  importedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface RowProblem {
  rowNo: number;
  /** 跨行或整表级问题（表头不匹配、超行数上限）为空串 */
  column: string;
  value: string;
  reason: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ImportPreview {
  batchNo: string;
  importType: string;
  fileName: string;
  totalRows: number;
  insertRows: number;
  updateRows: number;
  skipRows: number;
  /** 存在任一错误行即为 false（规则 I3），前端据此禁用「确认写入」 */
  canConfirm: boolean;
  errorCount: number;
  warningCount: number;
  errors: RowProblem[];
  warnings: RowProblem[];
  notes: string[];
  errorReportAvailable: boolean;
}

export interface RevokeResult {
  batchNo: string;
  revokedRows: number;
  /** 因「已被后续修改」而跳过的行（规则 RB3），必须在界面上列出来 */
  skippedRows: number;
  skippedRowNos: number[];
}

export interface ImportBatchFilter {
  type?: string | null;
  result?: string | null;
  from?: string | null;
  to?: string | null;
}

export const importApi = {
  types: () => api.get<ImportTypeOption[]>('/api/imports/types'),

  page: (filter: ImportBatchFilter, pageNum: number, pageSize: number) =>
    api.get<PageResult<ImportBatch>>(
      `/api/imports${query({ ...filter, pageNum, pageSize })}`,
    ),

  detail: (batchNo: string) => api.get<ImportBatch>(`/api/imports/${batchNo}`),

  /** 第一步：上传并校验，不写业务数据 */
  upload: (type: string, file: File) => api.postFile<ImportPreview>(`/api/imports/${type}/uploads`, file),

  /** 第二步：确认写入 */
  confirm: (batchNo: string) => api.post<ImportBatch>(`/api/imports/${batchNo}/confirmation`),

  revoke: (batchNo: string) => api.post<RevokeResult>(`/api/imports/${batchNo}/revocation`),

  /**
   * 下载类接口给的是 URL 而不是 Promise。
   *
   * 文件下载走浏览器导航（`<a download>`）而不是 fetch + Blob：后端已经按 RFC 5987 给了
   * Content-Disposition 文件名与 Content-Length，交给浏览器能拿到原生下载进度条，
   * 而 fetch 成 Blob 会把整个文件读进内存，且文件名要在前端再拼一遍。
   */
  templateUrl: (type: string) => `/api/imports/templates/${type}`,
  sourceFileUrl: (batchNo: string) => `/api/imports/${batchNo}/source-file`,
  errorReportUrl: (batchNo: string) => `/api/imports/${batchNo}/error-report`,
};
