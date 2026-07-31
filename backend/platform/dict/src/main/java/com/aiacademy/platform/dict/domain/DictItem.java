package com.aiacademy.platform.dict.domain;

import java.time.OffsetDateTime;

/**
 * 字典项一行（需求 13.9.3 Tab 2）。
 *
 * @param itemCode   编码。<b>一经创建不可修改</b>（规则 DC2）——历史数据存的是编码，改编码等于
 *                   静默改写历史记录的含义
 * @param parentCode 上级分类编码，仅课程分类使用
 * @param seqNo      排序号，决定下拉选项顺序；相同排序号按编码升序（规则 DC3）
 * @param enabled    停用后不影响已引用它的历史数据，仅在新建时不再可选（规则 DC1）
 */
public record DictItem(
        Long id,
        String dictType,
        String itemCode,
        String itemName,
        String parentCode,
        Integer seqNo,
        Boolean enabled,
        OffsetDateTime updatedAt,
        String updatedBy) {
}
