package com.aiacademy.platform.statemachine.service;

/**
 * 一次状态转换请求，对应接口 {@code POST /api/{objectType}/{id}/transitions}（开发 7.4）。
 *
 * @param stateField 状态字段中文名。一个对象有多个状态字段，缺了这一项就不知道要改哪一列
 * @param action 英文动作码
 * @param expectedVersion 客户端在详情接口拿到的 {@code version}，用于乐观锁与防重复提交（K1、K2）。
 *                        <b>可以为 null</b>：一是需求、课程、案例之外的对象没有 version 列（K1 只给
 *                        三张表加）；二是系统自动流转（随主状态置子状态、任务自动关闭）没有客户端，
 *                        无从提供版本号。为 null 时不做版本校验，并发安全由 {@code FOR UPDATE} 行锁兜住
 * @param remark 变更说明。共享账号下运营可在此自报操作人姓名（需求 5.11、AC1）
 */
public record TransitCommand(
        String objectType,
        long objectId,
        String stateField,
        String action,
        Integer expectedVersion,
        String remark) {

    public static TransitCommand of(String objectType, long objectId, String stateField, String action) {
        return new TransitCommand(objectType, objectId, stateField, action, null, null);
    }
}
