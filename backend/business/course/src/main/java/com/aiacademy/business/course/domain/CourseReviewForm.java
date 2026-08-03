package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * 录入评审结论的表单（需求 9.6.1 第 5～10 项）。
 *
 * <p><b>轮次与绑定版本号不在这里。</b>它们在「课程提交评审」那一刻就由系统写定了（规则 R7），
 * 让运营在录结论时还能改，等于允许把这条记录的评审对象改成另一版材料。
 *
 * <p><b>一期不做的四项</b>（需求 9.6.1 表末，议题 10、11）：专家人数校验、多人结论汇总、
 * 「有条件通过」结论、评审专家回避校验。参与评审人员是自由文本，不做人员关联也不校验人数。
 */
public record CourseReviewForm(
        List<String> reviewForms,

        @NotNull(message = "请填写评审日期")
        LocalDate reviewDate,

        @Size(max = 500, message = "参与评审人员不超过 500 字")
        String participants,

        @NotBlank(message = "请选择评审结果")
        String reviewResult,

        @NotBlank(message = "请填写评审专业意见")
        @Size(max = 5000, message = "评审专业意见不超过 5000 字")
        String reviewOpinion,

        @Size(max = 5000, message = "问题清单不超过 5000 字")
        String issueList) {
}
