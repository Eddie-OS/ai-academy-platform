package com.aiacademy.app.schedule;

import com.aiacademy.aggregate.warning.domain.LightColor;
import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.aggregate.warning.service.WarningLightService;
import com.aiacademy.app.repository.WarningSnapshotMapper;
import com.aiacademy.common.event.LightColorChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 每日 8:30 灯色快照（开发 5.4.2）。
 *
 * <p>只写 {@code snapshot_warning_light} 并在灯色变化时发 {@link LightColorChangedEvent}。
 * <b>不发送任何通知</b>——一期无消息渠道；阶段 4 催办再订阅该事件。
 */
@Component
public class WarningLightSnapshotJob {

    private static final Logger log = LoggerFactory.getLogger(WarningLightSnapshotJob.class);

    private final WarningLightService lights;
    private final WarningSnapshotMapper snapshots;
    private final ApplicationEventPublisher events;

    public WarningLightSnapshotJob(WarningLightService lights,
                                   WarningSnapshotMapper snapshots,
                                   ApplicationEventPublisher events) {
        this.lights = lights;
        this.snapshots = snapshots;
        this.events = events;
    }

    @Scheduled(cron = "0 30 8 * * *")
    @Transactional
    public void snapshot() {
        int changed = 0;
        for (WarningLightView view : lights.calcAllForSnapshot()) {
            String api = view.light();
            String snapshotCode = LightColor.fromApi(api).snapshotCode();
            String previous = snapshots.findLight(view.objectType(), view.objectId());
            snapshots.upsert(view.objectType(), view.objectId(), snapshotCode);
            if (previous == null || !previous.equals(snapshotCode)) {
                String fromApi = previous == null ? null : LightColor.fromSnapshot(previous).apiCode();
                events.publishEvent(new LightColorChangedEvent(
                        view.objectType(), view.objectId(), fromApi, api));
                changed++;
            }
        }
        log.info("灯色快照完成：变化 {} 条（仅落库，不发通知）", changed);
    }
}
