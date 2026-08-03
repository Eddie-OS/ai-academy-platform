package com.aiacademy.app.application.effect;

import com.aiacademy.platform.statemachine.domain.Transition;

/**
 * 一次副作用执行的上下文：<b>哪个对象、刚刚发生了哪条转换</b>。
 *
 * @param objectType 状态机对象类型（{@code COURSE}、{@code COURSE_REVIEW}…）
 * @param objectId 对象主键
 * @param transition 刚执行完的转换定义，副作用码从 {@link Transition#effects()} 取
 * @param remark 变更说明，原样透传给副作用引发的二次转换（如随主状态置子状态），
 *               让流转日志上这两条记录能对上同一次操作
 */
public record EffectContext(String objectType, long objectId, Transition transition, String remark) {
}
