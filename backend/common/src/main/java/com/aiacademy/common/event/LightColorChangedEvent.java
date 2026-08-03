package com.aiacademy.common.event;

/**
 * 灯色发生变化（开发 5.4.2、需求 D2）。
 *
 * <p>阶段 3 快照任务在发现灯色变化时发布；阶段 4 的催办／待办清单再订阅。
 * 本事件<b>不触发任何消息发送</b>——一期不做消息渠道。
 *
 * @param objectType 状态机对象类型码（{@code DEMAND}／{@code COURSE}…）
 * @param objectId   对象主键
 * @param fromLight  快照中的旧灯色 API 码（{@code BLUE}/{@code YELLOW}/{@code RED}/{@code NONE}）；首次入快照时为 null
 * @param toLight    当前实时灯色 API 码
 */
public record LightColorChangedEvent(
        String objectType,
        long objectId,
        String fromLight,
        String toLight) {
}
