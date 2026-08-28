import { api } from './client';

export interface AsyncExportAccepted {
  async: true;
  taskId: number;
}

export interface ExportTaskStatus {
  id: number;
  resourceType: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | string;
  fileName: string | null;
  rowCount: number | null;
  errorMessage: string | null;
}

/**
 * 列表导出：同步时浏览器直接下文件；异步时每 3 秒轮询（开发 5.11.2）。
 */
export async function exportList(pathWithQuery: string): Promise<'sync' | number> {
  const response = await fetch(pathWithQuery, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await response.json()) as { code: string; data: AsyncExportAccepted };
    if (body.code !== 'OK' || !body.data?.async) {
      throw new Error('导出失败');
    }
    return body.data.taskId;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.xlsx';
  a.click();
  URL.revokeObjectURL(url);
  return 'sync';
}

export const exportsApi = {
  status: (id: number) => api.get<ExportTaskStatus>(`/api/exports/${id}`),
  downloadUrl: (id: number) => `/api/exports/${id}/download`,
};

/** 每 3 秒轮询直至 DONE／FAILED。 */
export async function pollExportTask(
  taskId: number,
  onDone: (id: number) => void,
  onFail: (message: string) => void,
): Promise<void> {
  const tick = async () => {
    const status = await exportsApi.status(taskId);
    if (status.status === 'DONE') {
      onDone(taskId);
      return;
    }
    if (status.status === 'FAILED') {
      onFail(status.errorMessage ?? '导出失败');
      return;
    }
    window.setTimeout(() => {
      void tick();
    }, 3000);
  };
  await tick();
}
