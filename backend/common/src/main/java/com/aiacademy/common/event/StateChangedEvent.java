package com.aiacademy.common.event;

import java.time.OffsetDateTime;

/**
 * 状态已变更。由状态机引擎在写库之后发布，{@code platform/audit} 监听它写状态流转日志。
 *
 * <p><b>为什么这个契约放在 common：</b>发布方在 {@code platform/statemachine}、订阅方在
 * {@code platform/audit}，两个平台模块在 Gradle 层面互不依赖（根 build 脚本只给它们连了
 * {@code common}），这是刻意的——引擎不该知道有谁在听。事件类放 common 是两者唯一的共同可见处。
 *
 * <p>字段只收 1B 有消费方的那些。转换的副作用码（{@code Effect}）与「退出预警范围」标记
 * <b>刻意没带上</b>：
 * 一期它们的消费方（任务派生、预警计算）在阶段 3，届时加字段只改这一个 record。现在带上就是
 * 没人读的字段，反而会让人以为引擎已经在联动了。
 *
 * @param objectType 对象类型码，取状态机 {@code objectType()}
 * @param stateField 状态字段中文名，与需求 5.11「状态字段名」列一致
 * @param fromState 变更前状态。对象新建或该字段尚未置值时为 null
 * @param actionCode 触发本次转换的动作码
 * @param remark 变更说明。共享账号下运营可在此自报操作人姓名（需求 5.11、AC1）
 */
public record StateChangedEvent(
        String objectType,
        long objectId,
        String stateField,
        String fromState,
        String toState,
        String actionCode,
        OffsetDateTime changedAt,
        String remark) {
}
