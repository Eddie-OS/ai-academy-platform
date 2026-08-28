package com.aiacademy.app.web.controller;

import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.app.application.TrainingApplicationService;
import com.aiacademy.app.web.WarningLightAssembler;
import com.aiacademy.app.web.dto.TrainingPlanVO;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import com.aiacademy.business.training.domain.TrainingPlanForm;
import com.aiacademy.business.training.domain.TrainingPlanListItem;
import com.aiacademy.business.training.domain.TrainingPlanQuery;
import com.aiacademy.business.training.service.TrainingPlanService;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 培训计划列表与详情（需求 11.3、11.8，页面 P4-2／P4-3）。
 *
 * <p><b>这里没有任何判权代码。</b>写接口一律带 {@code @WriteApi}，判定由
 * {@code PermissionInterceptor} 一处完成（AR-7、PMI-1）。计划有 {@code owner_no}，
 * 但它<b>不参与判权</b>（需求 11.3 第 4 项、纪律 PMI-4）。
 *
 * <p><b>状态变更不在这里。</b>计划的三条转换都不需要同时录入业务字段，全部走统一转换接口
 * {@code POST /api/training-plans/{id}/transitions}（开发 7.4）。
 */
@RestController
@RequestMapping("/api/training-plans")
public class TrainingPlanController {

    private final TrainingPlanService plans;
    private final TrainingApplicationService application;
    private final WarningLightAssembler warningLights;

    public TrainingPlanController(TrainingPlanService plans, TrainingApplicationService application,
                                  WarningLightAssembler warningLights) {
        this.plans = plans;
        this.application = application;
        this.warningLights = warningLights;
    }

    /** 新建培训计划（需求 5.7 第 1 行）。返回主键，前端据此跳详情页。 */
    @WriteApi
    @PostMapping
    public R<Long> create(@Valid @RequestBody TrainingPlanForm form) {
        return R.ok(application.createPlan(form));
    }

    @WriteApi
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable long id, @Valid @RequestBody TrainingPlanForm form) {
        application.updatePlan(id, form);
        return R.ok(null);
    }

    /** 逻辑删除（SEC2）。下面还挂着场次时会被拒绝，理由见 {@code TrainingPlanService.softDelete}。 */
    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        plans.softDelete(id);
        return R.ok(null);
    }

    /**
     * 计划列表（需求 11.8 P4-2）。筛选条件全部可选，一个都不传即全量分页。
     *
     * <p>课程名称一次性批量补齐，不在 SQL 里 JOIN——{@code biz_course} 属课程模块（AR-1）。
     */
    @GetMapping
    public R<PageResult<TrainingPlanVO>> list(TrainingPlanQuery query) {
        PageResult<TrainingPlanListItem> page = plans.page(query);
        Map<Long, String> courseNames =
                application.courseNamesOf(page.records(), TrainingPlanListItem::getCourseId);
        Map<Long, WarningLightView> lights = warningLights.index(
                TrainingStateMachines.PLAN_OBJECT_TYPE,
                page.records().stream().map(TrainingPlanListItem::getId).toList());
        return R.ok(new PageResult<>(
                page.records().stream()
                        .map(p -> TrainingPlanVO.of(p, courseNames.get(p.getCourseId()),
                                lights.getOrDefault(p.getId(), WarningLightView.none(
                                        TrainingStateMachines.PLAN_OBJECT_TYPE, p.getId()))))
                        .toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }

    @GetMapping("/{id}")
    public R<TrainingPlanVO> detail(@PathVariable long id) {
        TrainingPlanListItem plan = plans.get(id);
        return R.ok(TrainingPlanVO.of(plan,
                application.courseNames(java.util.List.of(plan.getCourseId()))
                        .get(plan.getCourseId()),
                warningLights.one(TrainingStateMachines.PLAN_OBJECT_TYPE, id)));
    }
}
