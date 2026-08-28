package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseMaterialVersion;
import com.aiacademy.business.course.domain.CourseMaterialVersionFile;
import com.aiacademy.business.course.domain.CourseVersionLedgerForm;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.business.course.repository.CourseVersionMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.service.AttachmentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 材料版本快照（需求 9.5，规则 R7）。
 *
 * <p>两个触发口径（需求 9.5.1）：提交评审时系统自动快照，以及运营手动创建快照。两者走同一段
 * 代码，只有 {@code triggerType} 不同——自动快照如果另写一份实现，「提交评审时快照的内容」
 * 与「手动快照的内容」迟早会不一致，而前者才是评审记录绑定的那一份。
 *
 * <p><b>不冻结材料</b>（需求 9.5.1「是否冻结」行）：快照之后当前材料仍可继续修改，改动不影响
 * 已产生的版本。这也是快照必须复制一份元数据、而不能只记一个时间点的原因。
 */
@Service
public class CourseVersionService {

    private static final Logger log = LoggerFactory.getLogger(CourseVersionService.class);

    /** 需求 9.5.2 第 5 项的两个取值。 */
    public static final String TRIGGER_AUTO = "提交评审自动";
    public static final String TRIGGER_MANUAL = "手动创建";

    private final CourseVersionMapper versions;
    private final CourseMapper courses;
    private final AttachmentService attachments;

    public CourseVersionService(CourseVersionMapper versions, CourseMapper courses,
                                AttachmentService attachments) {
        this.versions = versions;
        this.courses = courses;
        this.attachments = attachments;
    }

    /**
     * 产生一个新版本（规则 R7）。
     *
     * <p>先 {@code FOR UPDATE} 锁课程行再算版本号：共享账号下两名运营同时点「提交评审」是常态
     * （CLAUDE.md 第七节），不锁就会算出两个 V2，靠唯一约束报错时运营看到的是一次没有解释的失败。
     *
     * @param triggerType {@link #TRIGGER_AUTO} 或 {@link #TRIGGER_MANUAL}
     */
    @Transactional
    public CourseMaterialVersion snapshot(long courseId, String triggerType, String remark) {
        if (courses.lockById(courseId) == null) {
            throw new NotFoundException("课程不存在或已删除：" + courseId);
        }
        String operator = OperatorContext.current().account().name();
        String versionNo = versions.nextVersionNo(courseId);
        long versionId = versions.insertVersion(courseId, versionNo, triggerType, remark, operator);

        int files = versions.copyCurrentMaterials(courseId, versionId, operator);
        int selfcheckItems = versions.copySelfcheck(courseId, versionId, operator);
        linkSnapshotAttachments(courseId, versionId, operator);

        courses.updateCurrentMaterialVersion(courseId, versionNo, operator);
        log.info("课程 {} 产生材料版本 {}（{}）：文件 {} 个、自检快照 {} 条",
                courseId, versionNo, triggerType, files, selfcheckItems);
        return versions.findVersions(courseId).stream()
                .filter(v -> v.id() == versionId)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("刚写入的版本读不回来：" + versionId));
    }

    @Transactional(readOnly = true)
    public List<CourseMaterialVersion> list(long courseId) {
        return versions.findVersions(courseId);
    }

    @Transactional(readOnly = true)
    public List<CourseMaterialVersionFile> files(long versionId) {
        return versions.findVersionFiles(versionId);
    }

    /** 版本快照下来的自检结果（规则 CK4）。 */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> selfcheckSnapshot(long versionId) {
        return versions.findSelfcheckSnapshot(versionId);
    }

    @Transactional(readOnly = true)
    public CourseMaterialVersion latest(long courseId) {
        return versions.findLatest(courseId);
    }

    /**
     * 保存版本台账。不改 {@code version_no}、不删文件、不写流转日志、不动课程五个状态列。
     */
    @Transactional
    public CourseMaterialVersion saveLedger(long courseId, long versionId, CourseVersionLedgerForm form) {
        if (versions.findByCourseAndId(courseId, versionId) == null) {
            throw new NotFoundException("材料版本不存在或已删除：" + versionId);
        }
        String status = blankToNull(form.versionStatus());
        if (status != null && !CourseEnums.VERSION_STATUSES.contains(status)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "版本状态只能是：%s".formatted(String.join(" / ", CourseEnums.VERSION_STATUSES)));
        }
        String operator = OperatorContext.current().account().name();
        versions.updateLedger(courseId, versionId,
                blankToNull(form.versionLabel()),
                status,
                blankToNull(form.ownerNo()),
                form.updatedDate(),
                blankToNull(form.coursewareUrl()),
                blankToNull(form.recordingUrl()),
                blankToNull(form.remark()),
                operator);
        CourseMaterialVersion saved = versions.findByCourseAndId(courseId, versionId);
        if (saved == null) {
            throw new NotFoundException("材料版本不存在或已删除：" + versionId);
        }
        return saved;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * 让版本自己持有一份附件引用。
     *
     * <p>没有这一步，运营把当前材料换掉之后，旧文件的最后一条引用就没了，孤儿清理会在 24 小时后
     * 把它<b>物理删除</b>（{@code AttachmentMapper.findOrphans} 只认 {@code sys_attachment_ref}），
     * 而绑定这个版本的评审记录还指着它。R7 的「历史评审记录永远指向当时的材料」就是断在这里。
     */
    private void linkSnapshotAttachments(long courseId, long versionId, String operator) {
        String refField = CourseEnums.versionRefField(versionId);
        List<CourseMaterialVersionFile> snapshotFiles = versions.findVersionFiles(versionId);
        for (CourseMaterialVersionFile file : snapshotFiles) {
            attachments.link(file.attachmentId(), AttachmentOwnerType.COURSE, courseId,
                    refField, file.seqNo());
        }
    }
}
