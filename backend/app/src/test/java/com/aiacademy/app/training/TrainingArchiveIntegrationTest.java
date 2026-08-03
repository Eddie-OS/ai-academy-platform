package com.aiacademy.app.training;

import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.business.training.domain.TrainingArchive;
import com.aiacademy.business.training.domain.TrainingArchiveForm;
import com.aiacademy.business.training.service.TrainingArchiveService;
import com.aiacademy.business.training.service.TrainingSessionService;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 培训归档（阶段 2 C-3 批，需求 11.6）。
 *
 * <p>本类里最要紧的一条是 {@link #归档完成标记不阻断状态转换()}：需求 11.6 的措辞是
 * 「置是后场次可转已归档」，读起来像个前置校验，但规则 C2 不允许状态变更做业务前置校验。
 */
class TrainingArchiveIntegrationTest extends TrainingTestBase {

    @Autowired
    private TrainingArchiveService archives;

    @Autowired
    private TrainingSessionService sessions;

    @Autowired
    private TransitionApplicationService transitions;

    @Test
    @DisplayName("没归档过的场次返回空壳而不是 404——归档页签打开时本来就是空的")
    void 未归档返回空壳() {
        long sessionId = 造场次("未归档");

        TrainingArchive archive = archives.get(sessionId);

        assertThat(archive.id()).isNull();
        assertThat(archive.sessionId()).isEqualTo(sessionId);
        assertThat(archive.archiveCompleted()).isFalse();
    }

    @Test
    @DisplayName("需求 11.6：直播链接、视频链接、纪要正文与归档完成标记落在同一条记录上")
    void 保存归档信息() {
        long sessionId = 造场次("保存归档");

        TrainingArchive saved = archives.save(sessionId, new TrainingArchiveForm(
                "https://live.example.com/1", "https://video.example.com/1", "纪要正文", true));

        assertThat(saved.liveLink()).isEqualTo("https://live.example.com/1");
        assertThat(saved.videoLink()).isEqualTo("https://video.example.com/1");
        assertThat(saved.minutesText()).isEqualTo("纪要正文");
        assertThat(saved.archiveCompleted()).isTrue();
        assertThat(saved.completedAt()).isNotNull();
    }

    @Test
    @DisplayName("一个场次只有一条归档记录：反复保存是更新而不是新增")
    void 一个场次一条记录() {
        long sessionId = 造场次("唯一记录");

        archives.save(sessionId, new TrainingArchiveForm(null, null, "第一稿", false));
        archives.save(sessionId, new TrainingArchiveForm(null, null, "第二稿", false));

        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM dtl_training_archive WHERE session_id = ? AND deleted = FALSE",
                Long.class, sessionId)).isEqualTo(1);
        assertThat(archives.get(sessionId).minutesText()).isEqualTo("第二稿");
    }

    @Test
    @DisplayName("归档完成时间只在标记由否变是那一次写，之后再存表单不刷新它")
    void 归档完成时间只写一次() {
        long sessionId = 造场次("完成时间");
        OffsetDateTime first = archives.save(sessionId,
                new TrainingArchiveForm(null, null, null, true)).completedAt();

        archives.save(sessionId, new TrainingArchiveForm(null, null, "补一段纪要", true));

        assertThat(archives.get(sessionId).completedAt())
                .describedAs("「什么时候归档完的」是个事实，不是最后编辑时间")
                .isEqualTo(first);
    }

    @Test
    @DisplayName("撤回归档完成标记时清空完成时间，再置是重新记")
    void 撤回标记清空完成时间() {
        long sessionId = 造场次("撤回标记");
        OffsetDateTime first = archives.save(sessionId,
                new TrainingArchiveForm(null, null, null, true)).completedAt();

        archives.save(sessionId, new TrainingArchiveForm(null, null, null, false));
        assertThat(archives.get(sessionId).completedAt()).isNull();

        OffsetDateTime again = archives.save(sessionId,
                new TrainingArchiveForm(null, null, null, true)).completedAt();
        assertThat(again).isAfterOrEqualTo(first);
    }

    @Test
    @DisplayName("需求 11.6：视频链接要过 URL 格式校验，一个域名字符串不算网址")
    void 链接必须是完整网址() {
        long sessionId = 造场次("链接校验");

        assertThatThrownBy(() -> archives.save(sessionId,
                new TrainingArchiveForm(null, "video.example.com/1", null, false)))
                .isInstanceOf(BizException.class)
                .satisfies(e -> assertThat(((BizException) e).errorCode())
                        .isEqualTo(ErrorCode.PARAM_INVALID));
    }

    @Test
    @DisplayName("规则 C2：归档完成标记没打勾也能走「完成归档」——加了硬校验就拦住补录历史培训")
    void 归档完成标记不阻断状态转换() {
        long sessionId = 造场次("不阻断");
        转换(sessionId, "START");
        转换(sessionId, "FINISH");

        转换(sessionId, "ARCHIVE");

        assertThat(sessions.get(sessionId).getSessionState())
                .isEqualTo(TrainingStateMachines.SESSION_ARCHIVED);
        assertThat(archives.get(sessionId).archiveCompleted()).isFalse();
    }

    private void 转换(long sessionId, String action) {
        transitions.transit(new TransitCommand(TrainingStateMachines.SESSION_OBJECT_TYPE, sessionId,
                TrainingStateMachines.FIELD_SESSION_STATE, action, null, null));
    }
}
