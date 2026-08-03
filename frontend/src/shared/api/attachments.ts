import { api, query } from './client';

/**
 * 附件上传与下载（开发实施文档 5.7）。
 *
 * <p>上传是三段式：申请票据 → 逐片 PUT → 完成合片。<b>即使是 1MB 的教案也走同一条路</b>——
 * 分出「小文件直传」的快捷通道，等于让 200MB 课件那条路只在少数场景被走到，
 * 而它恰恰是最容易出问题的一条。
 */

export interface Attachment {
  id: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  storagePath: string;
  sha256: string | null;
  createdAt: string;
  createdBy: string;
  deleted: boolean;
}

export interface UploadTicket {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  /** 已传分片序号，支持断点续传（规则 P5） */
  uploadedChunks: number[];
}

export const attachmentApi = {
  initUpload: (body: { fileName: string; fileSize: number; scene: string; ownerType: string }) =>
    api.post<UploadTicket>('/api/attachments/uploads', body),

  uploadStatus: (uploadId: string) => api.get<UploadTicket>(`/api/attachments/uploads/${uploadId}`),

  uploadChunk: (uploadId: string, index: number, chunk: Blob, fileName: string) =>
    api.putBlob<number>(`/api/attachments/uploads/${uploadId}/chunks/${index}`, chunk, fileName),

  complete: (uploadId: string) => api.post<Attachment>(`/api/attachments/uploads/${uploadId}/completion`),

  listOf: (refType: string, refId: number, refField: string) =>
    api.get<Attachment[]>(`/api/attachments${query({ refType, refId, refField })}`),

  /**
   * 业务保存时关联附件（开发 5.7.2 第 10 步）。
   *
   * <p><b>这一步不能省。</b>只上传不建引用的附件在 24 小时后会被当孤儿清理掉，而界面上还挂着
   * 它的文件名——直到有人点下载才发现文件没了。
   */
  link: (id: number, ref: { refType: string; refId: number; refField: string; seqNo: number }) =>
    api.post<void>(`/api/attachments/${id}/references`, ref),

  unlink: (id: number, ref: { refType: string; refId: number; refField: string; seqNo: number }) =>
    api.delete<void>(`/api/attachments/${id}/references`, ref),

  /** 下载走浏览器导航，理由同导入中心：能拿到原生下载进度条与后端给的文件名 */
  downloadUrl: (id: number) => `/api/attachments/${id}/download`,
};

/**
 * 走完三段式上传，返回落库后的附件。
 *
 * @param onProgress 0～100。上传 200MB 课件时没有进度条，使用者会以为界面卡死
 */
export async function uploadAttachment(
  file: File,
  scene: string,
  ownerType: string,
  onProgress?: (percent: number) => void,
): Promise<Attachment> {
  const ticket = await attachmentApi.initUpload({
    fileName: file.name,
    fileSize: file.size,
    scene,
    ownerType,
  });

  const done = new Set(ticket.uploadedChunks);
  for (let index = 0; index < ticket.totalChunks; index += 1) {
    if (!done.has(index)) {
      const start = index * ticket.chunkSize;
      await attachmentApi.uploadChunk(
        ticket.uploadId,
        index,
        file.slice(start, start + ticket.chunkSize),
        file.name,
      );
    }
    onProgress?.(Math.round(((index + 1) / ticket.totalChunks) * 100));
  }

  return attachmentApi.complete(ticket.uploadId);
}
