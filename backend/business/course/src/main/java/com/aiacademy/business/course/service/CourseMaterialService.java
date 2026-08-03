package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseMaterial;
import com.aiacademy.business.course.repository.CourseMaterialMapper;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.storage.domain.Attachment;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import com.aiacademy.platform.storage.domain.AttachmentScene;
import com.aiacademy.platform.storage.service.AttachmentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 课程材料的当前版本（需求 9.3.3）：三类材料各自挂多个附件。
 *
 * <p>附件走的是「先上传拿到附件ID、再挂到业务对象」的两段式（开发 5.7.2），所以这里收到的
 * 是附件ID 而不是文件流。
 */
@Service
public class CourseMaterialService {

    private final CourseMaterialMapper materials;
    private final CourseMapper courses;
    private final AttachmentService attachments;

    public CourseMaterialService(CourseMaterialMapper materials, CourseMapper courses,
                                 AttachmentService attachments) {
        this.materials = materials;
        this.courses = courses;
        this.attachments = attachments;
    }

    @Transactional(readOnly = true)
    public List<CourseMaterial> list(long courseId) {
        requireCourse(courseId);
        return materials.findByCourse(courseId);
    }

    /**
     * 把已上传的附件挂到课程的某类材料下。
     *
     * @return 挂载后该课程的全部材料
     */
    @Transactional
    public List<CourseMaterial> attach(long courseId, String materialType, List<Long> attachmentIds) {
        requireCourse(courseId);
        requireMaterialType(materialType);
        if (attachmentIds == null || attachmentIds.isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID, "请选择要挂载的附件");
        }

        String operator = OperatorContext.current().account().name();
        String refField = CourseEnums.materialRefField(materialType);
        int seqNo = materials.nextSeqNo(courseId, materialType);

        for (Long attachmentId : attachmentIds) {
            Attachment attachment = attachments.require(attachmentId);
            if (attachment.deleted()) {
                throw new NotFoundException("附件已删除：" + attachmentId);
            }
            checkSizeLimit(materialType, attachment);
            if (materials.countSame(courseId, materialType, attachmentId) > 0) {
                // 重复挂载多半是重复提交。按 K2 的语义静默跳过，表现为操作成功
                continue;
            }
            materials.insert(courseId, materialType, attachmentId, seqNo++, operator);
            // 明细表之外还要登记通用引用，否则孤儿清理会把文件物理删掉（CourseEnums.materialRefField）
            attachments.link(attachmentId, AttachmentOwnerType.COURSE, courseId, refField, seqNo);
        }
        return materials.findByCourse(courseId);
    }

    /**
     * 移除一个材料引用。附件本身只解引用、不删（规则 F5）——已快照的历史版本仍要能下载到它。
     */
    @Transactional
    public void detach(long courseId, long materialId) {
        requireCourse(courseId);
        CourseMaterial material = materials.findById(materialId);
        if (material == null || !material.courseId().equals(courseId)) {
            throw new NotFoundException("课程材料不存在：" + materialId);
        }
        String operator = OperatorContext.current().account().name();
        materials.softDelete(materialId, courseId, operator);
        attachments.unlink(material.attachmentId(), AttachmentOwnerType.COURSE, courseId,
                CourseEnums.materialRefField(material.materialType()));
    }

    /**
     * 挂载时复核大小上限（规则 F1）。
     *
     * <p>上传时按场景码校过一次，但场景码是客户端传的：把 100MB 的文件按「课件」传上来、
     * 再挂到「教案」下，只有这里能拦住。
     */
    private void checkSizeLimit(String materialType, Attachment attachment) {
        AttachmentScene scene = AttachmentScene.of(CourseEnums.materialScene(materialType));
        if (attachment.fileSize() > scene.maxBytes()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "「%s」单个文件不超过 %s（规则 F1），%s 超出上限"
                            .formatted(materialType, scene.maxSizeText(), attachment.fileName()));
        }
    }

    private void requireCourse(long courseId) {
        if (courses.selectById(courseId) == null) {
            throw new NotFoundException("课程不存在或已删除：" + courseId);
        }
    }

    private static void requireMaterialType(String materialType) {
        if (!CourseEnums.MATERIAL_TYPES.contains(materialType)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "材料类型只能是 %s，收到「%s」".formatted(CourseEnums.MATERIAL_TYPES, materialType));
        }
    }
}
