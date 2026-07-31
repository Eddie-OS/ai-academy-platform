package com.aiacademy.platform.dataimport.domain;

import java.util.List;

/**
 * 撤销结果（需求 13.8.5）。
 *
 * @param revokedRows 实际回滚的行数
 * @param skippedRows 因「已被后续修改」而跳过的行数（规则 RB3）
 * @param skippedRowNos 被跳过的 Excel 行号，界面要列出来给运营看（规则 RB3 明确要求「在撤销结果中
 *                      列出被跳过的记录」）——否则运营以为全撤了，实际有几行还留着旧批次的值
 */
public record RevokeResult(String batchNo, int revokedRows, int skippedRows, List<Integer> skippedRowNos) {
}
