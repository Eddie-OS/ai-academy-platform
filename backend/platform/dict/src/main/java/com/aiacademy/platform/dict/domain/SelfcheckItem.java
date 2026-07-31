package com.aiacademy.platform.dict.domain;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 课程自检 CheckList 题库一条（需求 9.4.1、《课程自检CheckList初版》三）。
 *
 * @param noteRequirement 说明文本的必填性：无 / 选填 / 必填。「必填」的条目勾选但未填说明
 *                        视为未完成（规则 CK2）；「无」的条目界面不给输入框
 * @param locked          锁定条目不允许停用（需求 9.4.1 列明的 5 条），但允许改文案
 * @param enabled         停用后历史记录仍可查看，但不计入完成度分母（规则 CK5）
 */
public record SelfcheckItem(
        Long id,
        String groupName,
        Integer seq,
        String itemText,
        String noteRequirement,
        String guideText,
        Boolean locked,
        Boolean enabled,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String NOTE_NONE = "无";
    public static final String NOTE_OPTIONAL = "选填";
    public static final String NOTE_REQUIRED = "必填";

    public static final List<String> NOTE_REQUIREMENTS = List.of(NOTE_NONE, NOTE_OPTIONAL, NOTE_REQUIRED);
}
