package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.EscalationPendingApplicationService;
import com.aiacademy.app.web.dto.EscalationPendingVO;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.platform.escalation.domain.EscalationForm;
import com.aiacademy.platform.escalation.domain.EscalationQuery;
import com.aiacademy.platform.escalation.domain.EscalationRecord;
import com.aiacademy.platform.escalation.service.EscalationService;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 催办台账与待催办清单（需求 13.2／13.5）。系统不发送任何消息。
 */
@RestController
@RequestMapping("/api/escalations")
@Validated
public class EscalationController {

    private final EscalationService escalations;
    private final EscalationPendingApplicationService pending;

    public EscalationController(EscalationService escalations,
                                EscalationPendingApplicationService pending) {
        this.escalations = escalations;
        this.pending = pending;
    }

    @GetMapping("/pending")
    public R<EscalationPendingVO> pending() {
        return R.ok(pending.build());
    }

    @GetMapping
    public R<PageResult<EscalationRecord>> page(EscalationQuery query) {
        return R.ok(escalations.page(query));
    }

    @GetMapping("/{id}")
    public R<EscalationRecord> get(@PathVariable long id) {
        return R.ok(escalations.get(id));
    }

    /**
     * 标记已催办（MSG2）。界面文案必须是「标记已催办」，不是「发送」。
     */
    @WriteApi
    @PostMapping
    public R<Long> mark(@Valid @RequestBody EscalationForm form) {
        return R.ok(escalations.mark(form));
    }
}
