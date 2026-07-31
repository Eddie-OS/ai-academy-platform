package com.aiacademy.platform.statemachine.service;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.event.StateChangedEvent;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.StateObjectMapping;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.repository.StateObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * 执行状态转换。<b>全库 16 个状态列的唯一写入者</b>（开发 5.1.4 的转换执行流程）。
 *
 * <p>把状态写入收在一处，是为了让「改状态必然写流转日志」成为结构而不是纪律。散在各业务模块时，
 * 这条规则有 16 处可以被漏掉，而漏掉的后果——效率指标少一条数据、红灯用错时间——<b>事后无法补齐</b>，
 * 因为没人知道当时的变更时间（出口准则 E1-2）。
 *
 * <p>本类<b>不判权</b>。需求 5.1 规则 C8 已确定全部状态变更的执行者都是运营账号，判权收敛在
 * {@code PermissionInterceptor} 一处（AR-7、PMI-1）。开发 5.1.4 流程图里的
 * {@code permission.assertCan(...)} 是 V1.0 的遗留，V1.1 简化权限模型后不再需要。
 *
 * <p>结构性副作用（快照材料版本、创建评审记录、置子状态）不在这里执行：它们要动业务表，
 * 而平台模块不得依赖业务模块（AR-2）。副作用码随转换一起返回给调用方，由业务侧或事件监听处理，
 * 阶段 2、3 落地。
 */
@Service
public class StateTransitionService {

    private final StateMachineRegistry registry;
    private final StateObjectMapper mapper;
    private final ApplicationEventPublisher events;

    public StateTransitionService(
            StateMachineRegistry registry,
            StateObjectMapper mapper,
            ApplicationEventPublisher events) {
        this.registry = registry;
        this.mapper = mapper;
        this.events = events;
    }

    /**
     * 执行一次转换，返回命中的转换定义（含副作用码，供调用方继续处理结构性副作用）。
     *
     * @throws NotFoundException 对象不存在或已逻辑删除
     * @throws com.aiacademy.common.exception.IllegalTransitionException 转换表里没有这个组合（规则 C3 硬阻断）
     * @throws BizException 版本号已变（{@code CONCURRENT_MODIFIED}）或该动作已生效（{@code DUPLICATE_SUBMIT}）
     */
    @Transactional
    public Transition transit(TransitCommand cmd) {
        StateObjectMapping mapping = StateObjectMappings.require(cmd.objectType());
        String column = mapping.columnOf(cmd.stateField());

        // 先锁行再查表：并发的两次「提交评审」必须一个一个来，否则两边都读到旧状态、各自算出同一个轮次
        String currentState = mapper.lockAndSelectState(mapping.table(), column, cmd.objectId());
        if (currentState == null && !mapper.existsById(mapping.table(), cmd.objectId())) {
            throw new NotFoundException("对象不存在或已删除：%s#%d".formatted(cmd.objectType(), cmd.objectId()));
        }

        Transition transition = registry
                .find(cmd.objectType(), cmd.stateField(), currentState, cmd.action())
                .orElse(null);
        if (transition == null) {
            rejectAsDuplicateIfAlreadyApplied(cmd, currentState);
            // 不是重复提交就是真非法。交给 registry 抛，异常文案里才有中文动作名（规则 C3 硬阻断）
            transition = registry.require(cmd.objectType(), cmd.stateField(), currentState, cmd.action());
        }

        OffsetDateTime changedAt = OffsetDateTime.now();
        String operator = OperatorContext.current().account().name();
        int affected = writeState(mapping, column, cmd, transition.to(), changedAt, operator);
        if (affected == 0) {
            throw new BizException(ErrorCode.CONCURRENT_MODIFIED,
                    "该记录已被修改（可能是其他运营人员），请刷新后重试");
        }

        // BEFORE_COMMIT 的监听器写流转日志，仍在本事务内：日志写失败则状态变更一并回滚（AR-6）
        events.publishEvent(new StateChangedEvent(
                cmd.objectType(), cmd.objectId(), cmd.stateField(),
                currentState, transition.to(), transition.action(), changedAt, cmd.remark()));

        return transition;
    }

    /**
     * 当前状态下没有这个动作时，先判断是不是「已经做过了」。
     *
     * <p>规则 K2 要求状态转换接口防重复提交，静默忽略而不是报错（开发 7.3 的 {@code DUPLICATE_SUBMIT}）。
     * 判据是：这个动作在本状态机里存在，而且它的目标状态<b>正是对象现在的状态</b>——说明请求想要的
     * 结果已经达成，第二次点击不该弹一个「当前状态不允许执行该动作」的红框。
     *
     * <p><b>为什么不按开发 5.10 的原文只靠版本号：</b>那句话成立的前提是对象有 {@code version} 列，
     * 而规则 K1 只给需求、课程、案例三张表加了这一列。评审记录、试讲记录、培训计划、培训场次、任务
     * 这五类对象照样有状态机、照样会被双击提交。改用「目标状态已达成」判重，八类对象一视同仁，
     * 且不需要客户端多传任何东西。带 version 的三张表仍然照 K1 做版本校验，两件事并存不冲突。
     */
    private void rejectAsDuplicateIfAlreadyApplied(TransitCommand cmd, String currentState) {
        boolean alreadyApplied = registry.requireMachine(cmd.objectType(), cmd.stateField())
                .transitions().stream()
                .filter(t -> t.action().equals(cmd.action()))
                .anyMatch(t -> t.to().equals(currentState));
        if (alreadyApplied) {
            throw new BizException(ErrorCode.DUPLICATE_SUBMIT, ErrorCode.DUPLICATE_SUBMIT.defaultMessage());
        }
    }

    private int writeState(StateObjectMapping mapping, String column, TransitCommand cmd,
                           String toState, OffsetDateTime changedAt, String operator) {
        if (!mapping.optimisticLocked()) {
            return mapper.updateState(mapping.table(), column, cmd.objectId(), toState, changedAt, operator);
        }
        // 客户端没传版本号（系统自动流转）时用库里的当前值：行已被 FOR UPDATE 锁住，读到的就是最新值
        int expectedVersion = Optional.ofNullable(cmd.expectedVersion())
                .orElseGet(() -> mapper.selectVersion(mapping.table(), cmd.objectId()));
        return mapper.updateStateWithVersion(mapping.table(), column, cmd.objectId(),
                toState, changedAt, operator, expectedVersion);
    }
}
