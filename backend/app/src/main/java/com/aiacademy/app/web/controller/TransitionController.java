package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.ObjectTypeRoutes;
import com.aiacademy.app.application.TransitionApplicationService;
import com.aiacademy.app.repository.StateLogQueryMapper;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.service.TransitCommand;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 全部对象的状态转换接口（《开发实施文档》7.4）。
 *
 * <p><b>15 个状态机、74 条转换共用这两个接口，不为每个动作单独开接口。</b>逐动作开接口的写法
 * 会让「新增一条转换」变成「新增一个 Controller 方法」，而转换表是需求第 5 章的直接映射，
 * 它增删的频率远高于接口契约应有的变更频率。
 *
 * <p>路径里的 {@code objectType} 是复数英文小写连字符（规则 API-1），对照表见
 * {@link ObjectTypeRoutes}。
 *
 * <p><b>本接口只做纯状态流转。</b>需要同时录入业务字段的操作（录入评审结论、录入试讲双结论）
 * 走各自业务模块的接口——那些操作里状态变更只是其中一步，拆成「先调业务接口存字段、
 * 再调本接口转状态」会让两者之间出现一个不一致的时间窗。
 */
@RestController
@RequestMapping("/api")
public class TransitionController {

    private final TransitionApplicationService transitions;
    private final StateLogQueryMapper stateLogs;

    public TransitionController(TransitionApplicationService transitions, StateLogQueryMapper stateLogs) {
        this.transitions = transitions;
        this.stateLogs = stateLogs;
    }

    /**
     * @param version 详情接口返回的乐观锁版本号。需求、课程、案例三类对象必传（规则 K1）；
     *                其余对象没有 version 列，传了也不会被校验
     * @param remark 变更说明。共享账号下运营在此自报操作人姓名（需求 5.11、决策 AC1）
     */
    public record TransitRequest(
            @NotBlank(message = "请指定要变更的状态字段")
            String stateField,

            @NotBlank(message = "请指定要执行的动作")
            String action,

            Integer version,

            @Size(max = 500, message = "变更说明不超过 500 字")
            String remark) {
    }

    public record TransitResponse(String stateField, String fromState, String toState,
                                  String action, String actionLabel) {
    }

    @WriteApi
    @PostMapping("/{objectType}/{id}/transitions")
    public R<TransitResponse> transit(@PathVariable String objectType,
                                      @PathVariable long id,
                                      @Valid @RequestBody TransitRequest request) {
        String type = ObjectTypeRoutes.requireObjectType(objectType);
        Transition transition = transitions.transit(new TransitCommand(
                type, id, request.stateField(), request.action(), request.version(), request.remark()));
        return R.ok(new TransitResponse(request.stateField(), transition.from(), transition.to(),
                transition.action(), transition.actionLabel()));
    }

    /**
     * 当前状态下每个状态字段可执行与不可执行的动作。
     *
     * <p>前端不做任何本地状态推断，按这里返回的 {@code allowedActions} / {@code blockedActions}
     * 渲染（CLAUDE.md 4.3.2 的 ActionGuard）。{@code blockedActions} 的 reason 说的是<b>状态原因</b>
     * 而不是权限原因——权限由用户账号下写入口整体不渲染来处理（纪律 PMI-5）。
     */
    @GetMapping("/{objectType}/{id}/transitions/available")
    public R<TransitionApplicationService.ObjectStateView> available(@PathVariable String objectType,
                                                                     @PathVariable long id) {
        return R.ok(transitions.available(ObjectTypeRoutes.requireObjectType(objectType), id));
    }

    /**
     * 该对象全部状态字段的流转日志，按时间倒序（需求 5.11，详情页的「状态流转日志」页签）。
     *
     * <p>读接口对两个账号无差异（纪律 PMI-2）。
     */
    @GetMapping("/{objectType}/{id}/state-logs")
    public R<List<StateLogQueryMapper.StateLogRow>> stateLogs(@PathVariable String objectType,
                                                              @PathVariable long id) {
        return R.ok(stateLogs.findByObject(ObjectTypeRoutes.requireObjectType(objectType), id));
    }
}
