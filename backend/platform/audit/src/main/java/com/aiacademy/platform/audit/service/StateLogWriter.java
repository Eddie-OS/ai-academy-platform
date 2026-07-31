package com.aiacademy.platform.audit.service;

import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.event.StateChangedEvent;
import com.aiacademy.platform.audit.domain.StateLog;
import com.aiacademy.platform.audit.repository.StateLogMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 状态流转日志的唯一写入口（需求 5.11、开发 5.2.2）。
 *
 * <p><b>它监听事件而不是被引擎直接调用</b>：引擎在 {@code platform/statemachine}，两个平台模块
 * 互不依赖（见 {@link StateChangedEvent} 的说明）。
 *
 * <p><b>为什么是 BEFORE_COMMIT 而不是 AFTER_COMMIT</b>（AR-6，ArchUnit 有断言）：日志写入与状态
 * 写入必须同生共死。用 AFTER_COMMIT 的话，日志插入失败时状态已经提交，对象停在新状态而没有任何
 * 流转记录——效率指标从此少一条数据、红灯判定用错时间，且这种缺失<b>无法事后补齐</b>，因为没人
 * 知道当时的变更时间。需求 16.1.3 把审计留痕列为一期优先级最高的非功能要求，就是这个意思。
 *
 * <p>因此这里<b>不捕获任何异常</b>。BEFORE_COMMIT 阶段抛出的异常会让整个事务回滚，
 * 状态变更随之作废——这正是想要的行为。
 */
@Component
public class StateLogWriter {

    private final StateLogMapper mapper;

    public StateLogWriter(StateLogMapper mapper) {
        this.mapper = mapper;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onStateChanged(StateChangedEvent event) {
        OperatorContext.Operator operator = OperatorContext.current();

        StateLog log = new StateLog();
        log.setObjectType(event.objectType());
        log.setObjectId(event.objectId());
        log.setStateField(event.stateField());
        log.setFromState(event.fromState());
        log.setToState(event.toState());
        log.setActionCode(event.actionCode());
        // 表的 CHECK 约束只允许 OPS 与 SYSTEM——用户账号改不了状态。真写进来一个 USER，说明有写
        // 接口漏了权限注解，让只读账号走到了状态转换上。此时宁可让约束报错，也不要静默改写成 OPS：
        // 改写会把一个权限漏洞伪装成一条正常的运营操作记录。
        log.setAccountType(operator.account().name());
        log.setChangedAt(event.changedAt());
        log.setRemark(event.remark());
        // operator_no / operator_name 留空：二期一人一账号时才写真实工号与姓名（开发 5.2.4）

        mapper.insert(log);
    }
}
