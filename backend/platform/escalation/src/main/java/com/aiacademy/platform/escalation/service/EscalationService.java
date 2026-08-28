package com.aiacademy.platform.escalation.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.platform.escalation.domain.EscalationConfig;
import com.aiacademy.platform.escalation.domain.EscalationForm;
import com.aiacademy.platform.escalation.domain.EscalationQuery;
import com.aiacademy.platform.escalation.domain.EscalationRecord;
import com.aiacademy.platform.escalation.repository.EscalationRecordMapper;
import com.aiacademy.platform.escalation.repository.EscalationRecordMapper.CycleEscalationMark;
import com.aiacademy.platform.escalation.repository.EscalationRecordMapper.EscalationInsert;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 催办台账写入与查询（开发 5.8.3／5.8.4）。系统不发送任何消息。
 */
@Service
public class EscalationService {

    private static final Set<String> ESCALATE_TYPES = Set.of("逾期", "停滞", "即将到期", "其他");
    private static final Set<String> SOURCES = Set.of("系统生成清单", "运营手动");

    /**
     * 错误 message 里的时间格式（设计规范 3.3：含时间用 {@code YYYY-MM-DD HH:mm}，不显示秒）。
     *
     * <p>{@code message} 要能直接贴到弹窗上（开发 7.2），拼 {@code OffsetDateTime.toString()}
     * 会给运营看到 {@code 2026-08-27T08:39:24.605868Z} —— 既带微秒又是 UTC，
     * 比本地时间早八小时，看起来像「我刚点的，怎么显示成早上八点」。
     * 结构化时间仍在 {@code data.lastEscalatedAt} 里按 ISO-8601 原样下发。
     */
    private static final DateTimeFormatter MESSAGE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final EscalationRecordMapper records;
    private final EscalationConfigService configs;
    private final Clock clock;

    public EscalationService(EscalationRecordMapper records,
                             EscalationConfigService configs,
                             Clock clock) {
        this.records = records;
        this.configs = configs;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResult<EscalationRecord> page(EscalationQuery query) {
        long total = records.countByQuery(query);
        List<EscalationRecord> rows = total == 0 ? List.of() : records.pageByQuery(query);
        return new PageResult<>(rows, total, query.getPageNum(), query.getPageSize());
    }

    @Transactional(readOnly = true)
    public EscalationRecord get(long id) {
        EscalationRecord row = records.findById(id);
        if (row == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "催办台账记录不存在");
        }
        return row;
    }

    @Transactional(readOnly = true)
    public List<CycleEscalationMark> marksSince(OffsetDateTime cycleStart) {
        return records.findMarksSince(cycleStart);
    }

    @Transactional(readOnly = true)
    public long countSince(OffsetDateTime cycleStart) {
        return records.countSince(cycleStart);
    }

    /**
     * 标记已催办。24h（可配置）内二次点击且未带 force → {@link ErrorCode#URGE_TOO_FREQUENT}。
     */
    @Transactional
    public long mark(EscalationForm form) {
        if (!ESCALATE_TYPES.contains(form.escalateType())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "催办事由不合法");
        }
        String source = form.source() == null || form.source().isBlank() ? "运营手动" : form.source();
        if (!SOURCES.contains(source)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "催办来源不合法");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        OffsetDateTime at = form.escalatedAt() == null ? now : form.escalatedAt();
        if (at.isAfter(now)) {
            throw new BizException(ErrorCode.PARAM_INVALID, "催办时间不能晚于当前时间");
        }

        EscalationConfig cfg = configs.get();
        OffsetDateTime latest = records.findLatestEscalatedAt(
                form.objectType(), form.objectId(), form.ownerNo());
        boolean force = Boolean.TRUE.equals(form.force());
        if (latest != null && !force) {
            long hours = ChronoUnit.HOURS.between(latest, now);
            if (hours < cfg.minIntervalHours()) {
                throw new BizException(
                        ErrorCode.URGE_TOO_FREQUENT,
                        "该对象已于 " + MESSAGE_TIME.format(latest.atZoneSameInstant(clock.getZone()))
                                + " 催办过，是否仍要记录？",
                        Map.of("lastEscalatedAt", latest.toString(),
                                "minIntervalHours", cfg.minIntervalHours()));
            }
        }

        EscalationInsert row = new EscalationInsert();
        row.objectType = form.objectType();
        row.objectId = form.objectId();
        row.objectName = form.objectName();
        row.ownerNo = form.ownerNo();
        row.ownerName = form.ownerName();
        row.escalateType = form.escalateType();
        row.channelNote = form.channelNote();
        row.remark = form.remark();
        row.escalatedAt = at;
        row.processNode = form.processNode();
        row.light = form.light();
        row.source = source;
        row.content = form.content();
        row.createdBy = OperatorContext.current().account().name();
        records.insert(row);
        return row.id;
    }
}
