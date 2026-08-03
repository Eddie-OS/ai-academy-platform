package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.FeedbackSummary;
import com.aiacademy.business.training.domain.TrainingFeedbackItem;
import com.aiacademy.business.training.repository.TrainingFeedbackMapper;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 学员反馈的查看与运营备注（需求 11.7）。
 *
 * <p><b>没有提交入口、没有修改正文的方法</b>（规则 FB2、FB1）：反馈只能由运营导入，
 * 正文任何账号不可改。这两条不是「先不做」，是界面上不留按钮、后端不留接口。
 */
@Service
public class TrainingFeedbackService {

    private final TrainingFeedbackMapper mapper;
    private final TrainingSessionService sessions;

    public TrainingFeedbackService(TrainingFeedbackMapper mapper, TrainingSessionService sessions) {
        this.mapper = mapper;
        this.sessions = sessions;
    }

    @Transactional(readOnly = true)
    public PageResult<TrainingFeedbackItem> page(long sessionId, int pageNum, int pageSize) {
        sessions.require(sessionId);
        long total = mapper.countBySession(sessionId);
        if (total == 0) {
            return new PageResult<>(List.of(), 0, pageNum, pageSize);
        }
        List<TrainingFeedbackItem> records =
                mapper.selectPage(sessionId, pageSize, (pageNum - 1) * pageSize);
        return new PageResult<>(records, total, pageNum, pageSize);
    }

    /** 场次的评分汇总。导入前的「本场次已有 N 条反馈」提示（规则 FB5）取的也是这里的 total。 */
    @Transactional(readOnly = true)
    public FeedbackSummary summary(long sessionId) {
        sessions.require(sessionId);
        return mapper.summary(sessionId);
    }

    /** 运营备注（需求 11.7.2 第 10 项）。传 null 或空串即清空备注。 */
    @Transactional
    public void updateOpsRemark(long sessionId, long feedbackId, String opsRemark) {
        TrainingFeedbackMapper.FeedbackRef ref = mapper.findRef(feedbackId);
        if (ref == null || ref.sessionId() != sessionId) {
            throw new NotFoundException("学员反馈不存在或已删除：" + feedbackId);
        }
        String value = opsRemark == null || opsRemark.isBlank() ? null : opsRemark.trim();
        mapper.updateOpsRemark(feedbackId, value, OperatorContext.current().account().name());
    }
}
