package com.aiacademy.business.training.service;

import com.aiacademy.business.training.domain.TrainingArchive;
import com.aiacademy.business.training.domain.TrainingArchiveForm;
import com.aiacademy.business.training.repository.TrainingArchiveMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * 培训归档（需求 11.6）。
 *
 * <p><b>归档完成标记不参与状态转换判定。</b>需求 11.6 写「置是后场次可转已归档」，但规则 C2 是
 * 状态变更只校验状态机合法性、不做业务前置条件。这里按 C2 实现：标记是运营的自查项，
 * 前端在场次还没打勾时给一句提示，「完成归档」按钮照常可点。
 * 反过来做的后果是补录历史培训被卡住——几年前的培训不会有人回头补现场照片。
 * 该偏离已记入待修文档清单。
 */
@Service
public class TrainingArchiveService {

    /** 直播与视频链接只认这两个协议。需求 11.6 要求 URL 格式校验，而 URL 不等于「带点的字符串」。 */
    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    private final TrainingArchiveMapper mapper;
    private final TrainingSessionService sessions;

    public TrainingArchiveService(TrainingArchiveMapper mapper, TrainingSessionService sessions) {
        this.mapper = mapper;
        this.sessions = sessions;
    }

    /** 还没归档过的场次返回空壳而不是 404：归档页签打开时本来就是空的。 */
    @Transactional(readOnly = true)
    public TrainingArchive get(long sessionId) {
        sessions.require(sessionId);
        TrainingArchive archive = mapper.selectBySession(sessionId);
        return archive == null ? TrainingArchive.empty(sessionId) : archive;
    }

    @Transactional(readOnly = true)
    public List<Long> completedSessionIds(List<Long> sessionIds) {
        return sessionIds.isEmpty() ? List.of() : mapper.findCompletedSessionIds(sessionIds);
    }

    /**
     * 保存归档信息。整表单覆盖：清空直播链接就是清空，不做「非空才写」。
     *
     * <p>归档完成时间只在标记<b>由否变是</b>的那一次写。反复保存表单不该刷新它——
     * 「什么时候归档完的」是个事实，不是「最后一次编辑时间」（后者有 {@code updated_at}）。
     * 标记撤回为否时清空，下次再置是重新记。
     */
    @Transactional
    public TrainingArchive save(long sessionId, TrainingArchiveForm form) {
        sessions.require(sessionId);
        validateLink(form.liveLink(), "直播链接");
        validateLink(form.videoLink(), "视频链接");

        TrainingArchive current = mapper.selectBySession(sessionId);
        boolean completed = form.completed();
        OffsetDateTime completedAt = completed
                ? (current != null && current.archiveCompleted() && current.completedAt() != null
                        ? current.completedAt() : OffsetDateTime.now())
                : null;

        mapper.upsert(sessionId, blankToNull(form.liveLink()), blankToNull(form.videoLink()),
                blankToNull(form.minutesText()), completed, completedAt, operator());
        return mapper.selectBySession(sessionId);
    }

    private static void validateLink(String value, String label) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            URI uri = URI.create(value.trim());
            if (uri.getScheme() == null || !ALLOWED_SCHEMES.contains(uri.getScheme().toLowerCase())
                    || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "%s 必须是完整的网址，以 http:// 或 https:// 开头".formatted(label));
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
