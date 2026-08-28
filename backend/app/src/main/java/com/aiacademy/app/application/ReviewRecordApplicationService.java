package com.aiacademy.app.application;

import com.aiacademy.app.repository.ReviewRecordMapper;
import com.aiacademy.app.web.dto.ReviewKpiVO;
import com.aiacademy.app.web.dto.ReviewRecordQuery;
import com.aiacademy.app.web.dto.ReviewRecordVO;
import com.aiacademy.common.api.PageResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 评审记录中心聚合查询（需求 13.3）。跨模块只读编排（AR-4）。
 */
@Service
public class ReviewRecordApplicationService {

    private final ReviewRecordMapper records;

    public ReviewRecordApplicationService(ReviewRecordMapper records) {
        this.records = records;
    }

    @Transactional(readOnly = true)
    public PageResult<ReviewRecordVO> page(ReviewRecordQuery query) {
        long total = records.count(query);
        List<ReviewRecordVO> rows = total == 0 ? List.of() : records.page(query);
        return new PageResult<>(rows, total, query.getPageNum(), query.getPageSize());
    }

    @Transactional(readOnly = true)
    public ReviewKpiVO kpis() {
        return records.kpis();
    }
}
