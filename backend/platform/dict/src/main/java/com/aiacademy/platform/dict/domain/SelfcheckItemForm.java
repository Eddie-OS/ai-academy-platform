package com.aiacademy.platform.dict.domain;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 自检清单项的新增／修改表单（需求 9.4.1「清单项须支持后台配置」）。
 *
 * <p>{@code itemText} 上限 300 与表列宽一致；《课程自检CheckList初版》四建议界面按 200 字提示，
 * 两者不冲突——建议是写作指导，300 是硬边界。
 */
public record SelfcheckItemForm(
        @NotBlank(message = "请填写所属分组")
        @Size(max = 32, message = "分组名不超过 32 字")
        String groupName,

        @NotNull(message = "请填写排序号")
        @Min(value = 1, message = "排序号从 1 开始")
        @Max(value = 9999, message = "排序号不超过 9999")
        Integer seq,

        @NotBlank(message = "请填写检查项描述")
        @Size(max = 300, message = "检查项描述不超过 300 字")
        String itemText,

        @NotBlank(message = "请选择说明的必填性")
        String noteRequirement,

        @Size(max = 300, message = "填写指引不超过 300 字")
        String guideText,

        @NotNull(message = "请选择启用状态")
        Boolean enabled) {
}
