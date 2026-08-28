package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.ReviewRecordApplicationService;
import com.aiacademy.app.web.dto.ReviewKpiVO;
import com.aiacademy.app.web.dto.ReviewRecordQuery;
import com.aiacademy.app.web.dto.ReviewRecordVO;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 评审记录中心（需求 13.3）。只读汇总，无审批引擎。
 */
@RestController
@RequestMapping("/api/review-records")
public class ReviewRecordController {

    private final ReviewRecordApplicationService records;

    public ReviewRecordController(ReviewRecordApplicationService records) {
        this.records = records;
    }

    @GetMapping
    public R<PageResult<ReviewRecordVO>> page(ReviewRecordQuery query) {
        return R.ok(records.page(query));
    }

    @GetMapping("/kpis")
    public R<ReviewKpiVO> kpis() {
        return R.ok(records.kpis());
    }
}
