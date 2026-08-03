package com.aiacademy.business.training.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

/**
 * 单条签到记录的修改（需求 11.5.3「运营角色可单条修改已导入的签到记录」）。
 *
 * <p><b>没有新增签到的入口。</b>签到的唯一录入方式是导入（业务确认项 6），单条修改是给
 * 「导入完之后发现某个人的状态填错了」用的补丁，不是第二条录入通道。名单里还没有签到记录的人，
 * 前端不给「标记已签到」按钮——补的办法是重新导一次那个场次。
 *
 * <p>导入批次号<b>不随修改改写</b>：改过的行仍属于原批次，撤销那一批时会一并撤掉。
 * 这是有意的——批次撤销的语义是「这次导入的数据全部作废」，手工改过的行也是那次导入带进来的。
 */
public record AttendanceForm(

        @NotBlank(message = "请选择签到状态")
        String attendStatus,

        OffsetDateTime attendTime,

        @Size(max = 500, message = "备注不超过 500 字")
        String remark) {
}
