package com.aiacademy.platform.dict.domain;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 字典项的新增／修改表单（需求 13.9.3）。
 *
 * <p>{@code itemCode} 只在新增时生效——规则 DC2 编码一经创建不可修改。修改接口收到它会直接忽略，
 * 而不是报错：前端把整行原样提交回来是正常做法，为此报错只会逼前端做一次无意义的字段裁剪。
 */
public record DictItemForm(
        @NotBlank(message = "请填写编码")
        @Size(max = 64, message = "编码不超过 64 字")
        @Pattern(regexp = "[A-Z0-9_]+", message = "编码只能用大写字母、数字与下划线")
        String itemCode,

        @NotBlank(message = "请填写名称")
        @Size(max = 200, message = "名称不超过 200 字")
        String itemName,

        @Size(max = 64, message = "上级分类编码不超过 64 字")
        String parentCode,

        @NotNull(message = "请填写排序号")
        @Min(value = 0, message = "排序号不能为负")
        @Max(value = 9999, message = "排序号不超过 9999")
        Integer seqNo,

        @NotNull(message = "请选择启用状态")
        Boolean enabled) {
}
