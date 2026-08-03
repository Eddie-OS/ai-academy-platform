package com.aiacademy.business.kase.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * 案例编辑表单（需求 12.3 的「仅运营」可编辑字段）。
 *
 * <p><b>没有对应的新建接口。</b>一期案例只有一个来源：课程标注达到精品标准时由 {@code CREATE_CASE}
 * 副作用自动创建（议题 27、C16-b）。学员成果与业务侧实践不能直接提交为案例（N10）。因此本表单
 * 只用于编辑，也因此不含案例ID、来源课程ID、创建时间、上架时间这些系统写入的字段。
 *
 * <p><b>不含案例状态与审核四字段。</b>状态列只能由状态机引擎写；审核四字段随「录入审核结论」
 * 一起录入（需求 12.3 第 9a～9d 项都标着「录入结论时 M」），放进通用编辑表单就没法表达这个
 * 「必须同时」，也会让运营绕过状态转换直接改审核结论。
 *
 * <p><b>案例正文的「上架时必填」不在这里校验。</b>那是一条状态前置条件，而 C9 把本期允许的
 * 业务前置校验限定为三处，案例上架不在其中——需求 12.3 第 11 项的「上架时 M」按 C2 处理成
 * 界面提示，不阻断状态转换。硬校验会拦住运营补录历史案例。
 *
 * @param contributors 贡献人工号，多选、选填（需求 12.3 第 5 项）
 * @param qualityMarks 精品标注，多选、选填（需求 12.3 第 10 项）
 */
public record CaseForm(
        @NotBlank(message = "请填写案例名称")
        @Size(max = 100, message = "案例名称不超过 100 字")
        String caseName,

        @NotBlank(message = "请填写贡献组织")
        @Size(max = 100, message = "贡献组织不超过 100 字")
        String contributingOrg,

        List<String> contributors,

        @NotEmpty(message = "请至少选择一个应用领域")
        List<String> domainCodes,

        @NotBlank(message = "请选择案例负责人")
        String ownerNo,

        List<String> qualityMarks,

        @Size(max = 20000, message = "案例正文不超过 20000 字")
        String content,

        LocalDate expectPublishDate) {
}
