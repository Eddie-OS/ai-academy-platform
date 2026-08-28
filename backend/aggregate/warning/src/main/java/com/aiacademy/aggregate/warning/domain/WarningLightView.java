package com.aiacademy.aggregate.warning.domain;

/**
 * 单个对象的实时灯色结果（V-9 口径）。
 *
 * @param light       API 码 {@link LightColor#apiCode()}
 * @param days        蓝／黄=剩余天数；红=逾期天数或停滞天数（随 {@code reason}）；无灯时为 null
 * @param reason      红灯原因文案「已逾期」或「状态停滞」；非红灯为 null
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
