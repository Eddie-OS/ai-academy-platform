package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.Size;

/**
 * 详情「关联课程」页签保存外链。
 *
 * <p>课程库 N:N 关联仍走 {@code rel_demand_course}；这里只记一条可跳转的 http/https 链接。
 *
 * @param version 乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record DemandCourseLinkForm(
        @Size(max = 2000, message = "关联链接不超过 2000 字")
        String courseLink,

        Integer version) {
}
