package com.aiacademy.business.lecturer.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * 讲师的新建与编辑表单。
 *
 * <p>业务确认后，可填项按「基础档案」截图表：简介、头像、等级、能力标签、可授课时间、
 * 上岗状态、排课限制、建档时间、档案维护人、备注。工号仍要——人员台账关联靠它。
 *
 * <p><b>不含入池方式。</b>由入池路径本身决定。试讲合格标记只能由试讲结论产生。
 *
 * <p>{@code trainingState} 仍接收：旧调用方只传培养状态。有 {@code dutyState} 时以它为准，
 * 培养状态按 {@link LecturerEnums#trainingStateOf} 对齐。
 */
public record LecturerForm(
        @NotBlank(message = "请填写讲师姓名")
        @Size(max = 50, message = "讲师姓名不超过 50 字")
        String lecturerName,

        @NotBlank(message = "请填写工号")
        @Size(max = 50, message = "工号不超过 50 字")
        String employeeNo,

        @NotBlank(message = "请填写来源部门")
        @Size(max = 50, message = "来源部门不超过 50 字")
        String sourceDept,

        @NotEmpty(message = "请填写擅长领域")
        List<String> expertiseDomains,

        @NotBlank(message = "请填写讲师简介")
        @Size(max = 500, message = "讲师简介不超过 500 字")
        String teachingDirection,

        String trainingState,

        @NotBlank(message = "请选择在池状态")
        String poolState,

        @Size(max = 500, message = "移出原因不超过 500 字")
        String removedReason,

        Long avatarAttachmentId,

        @Size(max = 16, message = "头像预设标识不超过 16 字")
        String avatarPreset,

        String lecturerLevel,

        @Size(max = 500, message = "能力标签不超过 500 字")
        String capabilityTags,

        @Size(max = 200, message = "可授课时间不超过 200 字")
        String availableTime,

        String dutyState,

        @Size(max = 200, message = "排课限制说明不超过 200 字")
        String scheduleLimit,

        LocalDate joinedDate,

        @Size(max = 50, message = "档案维护人不超过 50 字")
        String profileMaintainer,

        @Size(max = 500, message = "备注不超过 500 字")
        String remark) {
}
