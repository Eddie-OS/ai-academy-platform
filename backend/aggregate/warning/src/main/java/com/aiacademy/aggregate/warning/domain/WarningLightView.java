package com.aiacademy.aggregate.warning.domain;

/**
 * 单个对象的实时灯色结果（需求 13.4.1a）。
 *
 * @param light       API 码 {@link LightColor#apiCode()}
 * @param days        与灯色配套的天数：蓝=剩余天数、黄=逾期天数、红=停滞天数；无灯时为 null
 * @param reason      红灯原因文案；非红灯为 null
 * @param objectType  状态机对象类型码
 * @param objectId    对象主键
 */
public record WarningLightView(
        String objectType,
        long objectId,
        String light,
        Integer days,
        String reason) {

    public static WarningLightView none(String objectType, long objectId) {
        return new WarningLightView(objectType, objectId, LightColor.NONE.apiCode(), null, null);
    }
}
