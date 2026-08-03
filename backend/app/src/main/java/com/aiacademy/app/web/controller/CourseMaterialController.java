package com.aiacademy.app.web.controller;

import com.aiacademy.business.course.domain.CourseMaterial;
import com.aiacademy.business.course.domain.CourseMaterialVersion;
import com.aiacademy.business.course.domain.CourseMaterialVersionFile;
import com.aiacademy.business.course.service.CourseMaterialService;
import com.aiacademy.business.course.service.CourseVersionService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 课程材料与版本历史（需求 9.3.3、9.5，页面 P2-2 的「课程材料与版本」页签）。
 *
 * <p>页签分两区（需求 9.5.3）：上区当前材料可编辑，下区版本历史只读。<b>版本没有删除接口</b>——
 * 删掉一个版本，绑定它的评审记录就指向了不存在的材料，R7 直接失效。
 */
@RestController
@RequestMapping("/api/courses/{courseId}")
public class CourseMaterialController {

    private final CourseMaterialService materials;
    private final CourseVersionService versions;

    public CourseMaterialController(CourseMaterialService materials, CourseVersionService versions) {
        this.materials = materials;
        this.versions = versions;
    }

    // -------------------------------------------------------------------------
    // 上区：当前材料
    // -------------------------------------------------------------------------

    @GetMapping("/materials")
    public R<List<CourseMaterial>> materials(@PathVariable long courseId) {
        return R.ok(materials.list(courseId));
    }

    /**
     * 把已上传的附件挂到某类材料下。附件先经 {@code /api/attachments} 三段式上传拿到 ID
     * （开发 5.7.2），这里只做关联。
     */
    @WriteApi
    @PostMapping("/materials")
    public R<List<CourseMaterial>> attach(@PathVariable long courseId,
                                          @Valid @RequestBody AttachRequest request) {
        return R.ok(materials.attach(courseId, request.materialType(), request.attachmentIds()));
    }

    public record AttachRequest(
            @NotBlank(message = "请选择材料类型")
            String materialType,

            @NotEmpty(message = "请选择要挂载的附件")
            List<Long> attachmentIds) {
    }

    /** 从当前材料里移除。附件本身只解引用不删（规则 F5），历史版本仍能下载到它。 */
    @WriteApi
    @DeleteMapping("/materials/{materialId}")
    public R<Void> detach(@PathVariable long courseId, @PathVariable long materialId) {
        materials.detach(courseId, materialId);
        return R.ok(null);
    }

    // -------------------------------------------------------------------------
    // 下区：版本历史
    // -------------------------------------------------------------------------

    @GetMapping("/material-versions")
    public R<List<CourseMaterialVersion>> versions(@PathVariable long courseId) {
        return R.ok(versions.list(courseId));
    }

    /**
     * 手动创建快照（需求 9.5.1 快照触发的第 ② 种）。
     *
     * <p>提交评审时的自动快照不走这个接口，它是「自检 → 评审决策」转换的副作用。两者最终调的是
     * 同一段代码，区别只在 {@code triggerType}。
     */
    @WriteApi
    @PostMapping("/material-versions")
    public R<CourseMaterialVersion> snapshot(@PathVariable long courseId,
                                             @Valid @RequestBody(required = false) SnapshotRequest request) {
        String remark = request == null ? null : request.remark();
        return R.ok(versions.snapshot(courseId, CourseVersionService.TRIGGER_MANUAL, remark));
    }

    public record SnapshotRequest(
            @Size(max = 500, message = "变更说明不超过 500 字")
            String remark) {
    }

    @GetMapping("/material-versions/{versionId}")
    public R<VersionDetail> versionDetail(@PathVariable long courseId, @PathVariable long versionId) {
        return R.ok(new VersionDetail(versions.files(versionId), versions.selfcheckSnapshot(versionId)));
    }

    /**
     * @param selfcheck 该版本快照下来的自检结果（规则 CK4）。评审意见与自检内容要能对得上，
     *                  看的就是这一份而不是课程当前的自检勾选
     */
    public record VersionDetail(List<CourseMaterialVersionFile> files,
                                List<Map<String, Object>> selfcheck) {
    }
}
