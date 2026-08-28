package com.aiacademy.app.web.controller;

import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.DemandCourseLinkService;
import com.aiacademy.app.export.ExportPaging;
import com.aiacademy.app.export.ListExportService;
import com.aiacademy.app.repository.DemandCourseLinkMapper;
import com.aiacademy.app.web.WarningLightAssembler;
import com.aiacademy.app.web.dto.CourseVO;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseDevelopmentForm;
import com.aiacademy.business.course.domain.CourseInitiationForm;
import com.aiacademy.business.course.domain.CourseReviewLedgerForm;
import com.aiacademy.business.course.domain.CourseSelfcheckInfoForm;
import com.aiacademy.business.course.domain.CourseTrialLedgerForm;
import com.aiacademy.business.course.domain.CourseListItem;
import com.aiacademy.business.course.domain.CourseQuery;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 课程列表与详情（需求 9.3、9.10，页面 P2-1／P2-2）。
 *
 * <p><b>这里没有任何判权代码。</b>写接口一律带 {@code @WriteApi}，判定由
 * {@code PermissionInterceptor} 一处完成（AR-7、PMI-1）。课程有 {@code owner_no}，
 * 但它<b>不参与判权</b>——运营账号能改任何人负责的课程（纪律 PMI-4、CLAUDE.md 第八节第 1 条）。
 *
 * <p><b>状态变更不在这里。</b>除关闭外的全部状态动作走统一转换接口
 * {@code POST /api/courses/{id}/transitions}（开发 7.4）。关闭是唯一的例外，因为它要同时
 * 录入一个必填的业务字段。
 */
@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courses;
    private final CourseApplicationService application;
    private final DemandCourseLinkService links;
    private final WarningLightAssembler warningLights;
    private final ListExportService exports;

    public CourseController(CourseService courses, CourseApplicationService application,
                            DemandCourseLinkService links,
                            WarningLightAssembler warningLights,
                            ListExportService exports) {
        this.courses = courses;
        this.application = application;
        this.links = links;
        this.warningLights = warningLights;
        this.exports = exports;
    }

    /** 课程立项（需求 9.4）。返回新课程的主键，前端据此跳详情页。 */
    @WriteApi
    @PostMapping
    public R<Long> initiate(@Valid @RequestBody CourseForm form) {
        return R.ok(application.initiate(form));
    }

    /**
     * 编辑基本信息。
     *
     * @param version 乐观锁版本号（规则 K1）。共享账号下并发编辑是常态而非偶发，
     *                不传即按库里当前值更新，等于放弃冲突检测——前端应当始终回传详情里拿到的值
     */
    @WriteApi
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable long id,
                          @RequestParam(required = false) Integer version,
                          @Valid @RequestBody CourseForm form) {
        application.update(id, form, version);
        return R.ok(null);
    }

    /** 详情「立项」页整页保存。不改课程主状态。 */
    @WriteApi
    @PutMapping("/{id}/initiation")
    public R<Void> saveInitiation(@PathVariable long id,
                                  @Valid @RequestBody CourseInitiationForm form) {
        courses.saveInitiation(id, form);
        return R.ok(null);
    }

    /** 详情「开发」页整页保存。不改课程开发状态。 */
    @WriteApi
    @PutMapping("/{id}/development")
    public R<Void> saveDevelopment(@PathVariable long id,
                                   @Valid @RequestBody CourseDevelopmentForm form) {
        courses.saveDevelopment(id, form);
        return R.ok(null);
    }

    /** 详情「自检」页台账保存。不改课程自检子状态。 */
    @WriteApi
    @PutMapping("/{id}/selfcheck-info")
    public R<Void> saveSelfcheckInfo(@PathVariable long id,
                                     @Valid @RequestBody CourseSelfcheckInfoForm form) {
        courses.saveSelfcheckInfo(id, form);
        return R.ok(null);
    }

    /** 详情「评审」页台账保存。不改课程主状态与评审记录状态。 */
    @WriteApi
    @PutMapping("/{id}/review-ledger")
    public R<Void> saveReviewLedger(@PathVariable long id,
                                    @Valid @RequestBody CourseReviewLedgerForm form) {
        courses.saveReviewLedger(id, form);
        return R.ok(null);
    }

    /** 详情「试讲」页台账保存。不改五个状态列。 */
    @WriteApi
    @PutMapping("/{id}/trial-ledger")
    public R<Void> saveTrialLedger(@PathVariable long id,
                                   @Valid @RequestBody CourseTrialLedgerForm form) {
        courses.saveTrialLedger(id, form);
        return R.ok(null);
    }

    /** 关闭课程开发（需求 5.3.1 第 15 行）。状态转换与关闭原因必须一起成功。 */
    @WriteApi
    @PostMapping("/{id}/close")
    public R<Void> close(@PathVariable long id, @Valid @RequestBody CloseRequest request) {
        application.close(id, request.closeReason(), request.version());
        return R.ok(null);
    }

    public record CloseRequest(
            @NotBlank(message = "请填写关闭原因")
            @Size(max = 500, message = "关闭原因不超过 500 字")
            String closeReason,

            Integer version) {
    }

    /** 逻辑删除（SEC2）。数据不物理删除，导出的历史文件与流转日志仍能对上。 */
    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        courses.softDelete(id);
        return R.ok(null);
    }

    /**
     * 课程列表（需求 9.10）。筛选条件全部可选，一个都不传即全量分页。
     *
     * <p>读接口不做任何数据级过滤：一期两个账号的读权限完全无差异（纪律 PMI-2）。
     */
    @GetMapping
    public R<PageResult<CourseVO>> list(CourseQuery query) {
        PageResult<CourseListItem> page = courses.page(query);
        Map<Long, WarningLightView> lights = warningLights.index(
                CourseStateMachines.OBJECT_TYPE,
                page.records().stream().map(CourseListItem::getId).toList());
        return R.ok(new PageResult<>(page.records().stream()
                .map(c -> CourseVO.of(c, lights.getOrDefault(c.getId(),
                        WarningLightView.none(CourseStateMachines.OBJECT_TYPE, c.getId()))))
                .toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }

    @GetMapping("/export")
    public Object export(CourseQuery query) {
        query.setPageNum(1);
        query.setPageSize(1);
        long total = courses.page(query).total();
        query.setPageSize(200);
        List<String> headers = List.of("课程ID", "课程名称", "主状态", "负责人", "预计发布");
        var result = exports.exportAll("courses", query, total,
                () -> ExportPaging.loadAll(query::setPageNum, 200, ignored -> courses.page(query)),
                headers,
                c -> ListExportService.row(
                        "课程ID", c.getId(),
                        "课程名称", c.getCourseName(),
                        "主状态", c.getMainState(),
                        "负责人", c.getOwnerName(),
                        "预计发布", c.getExpectPublishDate()));
        if (result.async()) {
            return R.ok(Map.of("async", true, "taskId", result.taskId()));
        }
        return result.syncBody();
    }

    @GetMapping("/{id}")
    public R<CourseVO> detail(@PathVariable long id) {
        return R.ok(CourseVO.of(courses.get(id),
                warningLights.one(CourseStateMachines.OBJECT_TYPE, id)));
    }

    // -------------------------------------------------------------------------
    // 关联需求（需求 8.4，规则 R4「关联关系必须双向可查」）
    // -------------------------------------------------------------------------

    /** 课程详情页「关联需求」页签。与需求详情页的「关联课程」页签是同一份关联的两个视角。 */
    @GetMapping("/{id}/demands")
    public R<List<DemandCourseLinkMapper.LinkedDemand>> demands(@PathVariable long id) {
        return R.ok(links.demandsOf(id));
    }

    /** 从课程侧新增关联。与需求侧调的是同一个服务，两侧的校验与留痕因此不会长歪。 */
    @WriteApi
    @PostMapping("/{id}/demands")
    public R<Void> linkDemand(@PathVariable long id, @Valid @RequestBody LinkRequest request) {
        links.link(request.demandId(), id, request.linkNote());
        return R.ok(null);
    }

    @WriteApi
    @DeleteMapping("/{id}/demands/{demandId}")
    public R<Void> unlinkDemand(@PathVariable long id, @PathVariable long demandId) {
        links.unlink(demandId, id);
        return R.ok(null);
    }

    public record LinkRequest(
            @NotNull(message = "请选择要关联的需求")
            Long demandId,

            @Size(max = 200, message = "关联说明不超过 200 字")
            String linkNote) {
    }
}
