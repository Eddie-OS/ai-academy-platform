package com.aiacademy.platform.dict.domain;

import java.util.List;

/**
 * 五个驾驶舱共用的「所属／应用／擅长领域」取值（现场口径 D-21）。
 *
 * <p>原先课程、讲师、案例跟作战单元字典（AI需求／课程／…），需求已改成零售／MKT 等。
 * 领域是业务线，不是对象类型，两边不能再各用一套。
 *
 * <p>历史行仍可能是作战单元编码或名称，校验侧兼容，展示侧按名称回退。
 */
public final class BusinessDomains {

    private BusinessDomains() {
    }

    public static final List<String> NAMES =
            List.of("零售", "GTM", "电商", "MKT", "服务", "渠道", "政企");

    public static boolean contains(String value) {
        return value != null && NAMES.contains(value);
    }
}
