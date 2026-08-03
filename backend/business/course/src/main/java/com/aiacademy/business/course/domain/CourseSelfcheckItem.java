package com.aiacademy.business.course.domain;

/**
 * 课程自检页面上的一行：题库里的题目 + 这门课程对它的勾选结果（需求 9.4.1、9.4.2）。
 *
 * @param itemText 题目原文。<b>已勾选的行显示的是勾选当时的快照</b>（{@code item_text_snapshot}），
 *                 未勾选的行显示题库当前文本。题库改过之后，历史勾选不能跟着漂移（开发 6.3.9）
 * @param noteRequirement 说明的必填性：无 / 选填 / 必填。「必填」的条目勾了但没写说明视为未完成（CK2）
 * @param enabled 题目是否仍在启用。停用的题目<b>历史记录仍可查看，但不计入完成度分母</b>（CK5），
 *                所以停用且从未勾选过的题目根本不会出现在这个列表里
 * @param completed 该条是否算完成，口径见 CK2。<b>由后端算</b>——前端自己判会漏掉必填说明那一档
 */
public record CourseSelfcheckItem(
        Long itemId,
        String groupName,
        Integer seq,
        String itemText,
        String noteRequirement,
        String guideText,
        boolean enabled,
        boolean checked,
        String note,
        boolean completed) {
}
