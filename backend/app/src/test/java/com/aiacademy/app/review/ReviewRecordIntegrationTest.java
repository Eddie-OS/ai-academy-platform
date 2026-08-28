package com.aiacademy.app.review;

import com.aiacademy.app.application.ReviewRecordApplicationService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.app.web.dto.ReviewRecordQuery;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class ReviewRecordIntegrationTest extends IntegrationTest {

    @Autowired
    private ReviewRecordApplicationService records;

    @BeforeEach
    void setUp() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.4.2");
    }

    @AfterEach
    void tearDown() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("评审记录中心六个页签均可查询且 KPI 可返回")
    void 六页签与kpi() {
        for (String tab : new String[]{
                "COURSE_REVIEW", "COURSE_TRIAL", "DEMAND_REVIEW",
                "DEMAND_ACCEPTANCE", "CASE_AUDIT", "PENDING"}) {
            ReviewRecordQuery q = new ReviewRecordQuery();
            q.setTab(tab);
            assertThat(records.page(q).total()).isGreaterThanOrEqualTo(0);
        }
        var kpis = records.kpis();
        assertThat(kpis.courseReviewMonth()).isGreaterThanOrEqualTo(0);
        assertThat(kpis.pendingTotal()).isGreaterThanOrEqualTo(0);
    }
}
