package com.aiacademy.platform.dataimport.service;

import com.aiacademy.common.api.PageQuery;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.dataimport.domain.ImportBatch;
import com.aiacademy.platform.dataimport.repository.ImportBatchMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 导入批次列表（需求 13.8.4）。筛选项：导入类型、导入结果、导入时间区间；默认按导入时间倒序。
 */
@Service
public class ImportBatchQuery {

    private final ImportBatchMapper batches;

    public ImportBatchQuery(ImportBatchMapper batches) {
        this.batches = batches;
    }

    @Transactional(readOnly = true)
    public PageResult<ImportBatch> list(String importType, String importResult,
                                        OffsetDateTime from, OffsetDateTime to, PageQuery page) {
        long total = batches.count(importType, importResult, from, to);
        return PageResult.of(
                batches.list(importType, importResult, from, to, page.getPageSize(), (int) page.offset()),
                total, page);
    }

    @Transactional(readOnly = true)
    public ImportBatch findByNo(String batchNo) {
        return batches.findByNo(batchNo);
    }

    @Transactional(readOnly = true)
    public ImportBatch require(String batchNo) {
        ImportBatch batch = batches.findByNo(batchNo);
        if (batch == null) {
            throw new NotFoundException("导入批次不存在：" + batchNo);
        }
        return batch;
    }
}
