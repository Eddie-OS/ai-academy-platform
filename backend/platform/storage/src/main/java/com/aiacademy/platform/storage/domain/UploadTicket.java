package com.aiacademy.platform.storage.domain;

import java.util.List;

/**
 * 申请上传的结果（开发 5.7.2 第 3 步）。
 *
 * @param uploadId 分片目录名。前端每个分片都带上它
 * @param chunkSize 建议分片大小，字节（开发 5.7.2 建议 5MB）
 * @param totalChunks 按 chunkSize 算出的分片总数，前端据此循环
 * @param uploadedChunks <b>已经在服务端的分片序号</b>。断点续传（P5）就靠这一个字段：
 *                       前端拿同一个 uploadId 再申请一次，只补传缺的那几片
 */
public record UploadTicket(String uploadId, int chunkSize, int totalChunks, List<Integer> uploadedChunks) {
}
