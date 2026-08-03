package com.aiacademy.business.lecturer.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 讲师的新建与编辑表单（需求 10.3 中「可编辑 = 仅运营」的那几项）。
 *
 * <p><b>不含入池方式与入池时间。</b>它们是「首次入池」的事实（需求 10.4），由入池路径本身决定：
 * 手动添加写「运营手动添加」，导入写「批量导入」，课程负责人自动入池写第三个值。做成可填字段
 * 会让入池方式与真实来源脱节，而 10.4 的三种方式正是用来回答「这个人怎么进来的」。
 *
 * <p><b>不含试讲合格标记与首次试讲合格时间。</b>它们只能由试讲结论录入产生（副作用
 * {@code UPDATE_LECTURER_TRIAL_FLAG}）。允许手填等于允许伪造一条不存在的试讲。
 *
 * <p><b>培养状态在表单里。</b>它是自由选择的枚举（TS1），与在池状态一样属于普通字段——
 * 这也是它与状态机字段的唯一区别：状态机字段一律走转换接口，不出现在任何表单里。
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

        @NotEmpty(message = "请至少选择一个擅长领域")
        List<String> expertiseDomains,

        @NotBlank(message = "请填写授课方向")
        @Size(max = 500, message = "授课方向不超过 500 字")
        String teachingDirection,

        @NotBlank(message = "请选择讲师培养状态")
        String trainingState,

        @NotBlank(message = "请选择在池状态")
        String poolState,

        /** 在池状态为「已移出」时必填，跨字段校验在 {@code LecturerService} 里做。 */
        @Size(max = 500, message = "移出原因不超过 500 字")
        String removedReason) {
}
