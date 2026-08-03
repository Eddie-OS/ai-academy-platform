package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.application.DemandCourseLinkService;
import com.aiacademy.app.repository.DemandCourseLinkMapper;
import com.aiacademy.app.web.dto.DemandAcceptanceVO;
import com.aiacademy.app.web.dto.DemandReviewVO;
import com.aiacademy.app.web.dto.DemandVO;
import com.aiacademy.business.demand.domain.DemandAcceptanceForm;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandListItem;
import com.aiacademy.business.demand.domain.DemandQuery;
import com.aiacademy.business.demand.domain.DemandReviewForm;
import com.aiacademy.business.demand.service.DemandAcceptanceService;
import com.aiacademy.business.demand.service.DemandReviewService;
import com.aiacademy.business.demand.service.DemandService;
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

/**
 * 需求列表与详情（需求 8.3、8.6，页面 P1-1／P1-2）。
 *
 * <p><b>这里没有任何判权代码。</b>写接口一律带 {@code @WriteApi}，判定由
 * {@code PermissionInterceptor} 一处完成（AR-7、PMI-1）。需求有 {@code owner_no}，
 * 但它<b>不参与判权</b>——运营账号能改任何人负责的需求（需求 6.1.3、纪律 PMI-4）。
 *
 * <p><b>状态变更不在这里。</b>纯状态动作走统一转换接口
 * {@code POST /api/demands/{id}/transitions}（开发 7.4）；需要同时录入业务字段的动作
 * （录入评审结论、录入验收结论）走本模块的专用接口。
 */
@RestController
@RequestMapping("/api/demands")
public class DemandController {

    private final DemandService demands;
    private final DemandReviewService reviews;
    private final DemandAcceptanceService acceptances;
    private final DemandApplicationService application;
    private final DemandCourseLinkService links;

    public DemandController(DemandService demands, DemandReviewService reviews,
                            DemandAcceptanceService acceptances,
                            DemandApplicationService application,
                            DemandCourseLinkService links) {
        this.demands = demands;
        this.reviews = reviews;
        this.acceptances = acceptances;
        this.application = application;
        this.links = links;
    }

    /** 登记需求（需求 5.2.1 第 1 行）。返回新需求的主键，前端据此跳详情页。 */
    @WriteApi
    @PostMapping
    public R<Long> register(@Valid @RequestBody DemandForm form) {
        return R.ok(application.register(form));
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
                          @Valid @RequestBody DemandForm form) {
        demands.update(id, form, version);
        return R.ok(null);
    }

    /** 逻辑删除（SEC2）。数据不物理删除，导出的历史文件与流转日志仍能对上。 */
    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        demands.softDelete(id);
        return R.ok(null);
    }

    /**
     * 需求列表（需求 8.6）。筛选条件全部可选，一个都不传即全量分页。
     *
     * <p>读接口不做任何数据级过滤：一期两个账号的读权限完全无差异（纪律 PMI-2）。
     */
    @GetMapping
    public R<PageResult<DemandVO>> list(DemandQuery query) {
        PageResult<DemandListItem> page = demands.page(query);
        return R.ok(new PageResult<>(page.records().stream().map(DemandVO::of).toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }

    @GetMapping("/{id}")
    public R<DemandVO> detail(@PathVariable long id) {
        return R.ok(DemandVO.of(demands.get(id)));
    }

    // -------------------------------------------------------------------------
    // 评审与分流（需求 5.2.1～5.2.3）
    // -------------------------------------------------------------------------

    /**
     * 录入评审结论（需求 5.2.1 第 3 行）。<b>分流出口必填</b>，与结论同一笔事务。
     *
     * <p>不走统一转换接口的原因见 {@code TransitionController}：这里状态变更只是其中一步，
     * 拆成两次调用会让「已评审但没有出口」的需求真实存在于两次请求之间。
     */
    @WriteApi
    @PostMapping("/{id}/review-conclusion")
    public R<Long> recordReviewConclusion(@PathVariable long id,
                                          @Valid @RequestBody DemandReviewForm form) {
        return R.ok(application.recordReviewConclusion(id, form));
    }

    /** 评审记录列表（详情页「评审信息」页签），最新一轮在前。 */
    @GetMapping("/{id}/reviews")
    public R<List<DemandReviewVO>> reviews(@PathVariable long id) {
        return R.ok(reviews.listByDemand(id).stream().map(DemandReviewVO::of).toList());
    }

    /** 输出解决方案（需求 5.2.3 第 1 行）。方案名称与状态一起落库。 */
    @WriteApi
    @PostMapping("/{id}/solution")
    public R<Void> createSolution(@PathVariable long id, @Valid @RequestBody SolutionRequest request) {
        application.createSolution(id, request.solutionName().trim(), request.version());
        return R.ok(null);
    }

    public record SolutionRequest(
            @NotBlank(message = "请填写解决方案名称")
            @Size(max = 200, message = "解决方案名称不超过 200 字")
            String solutionName,

            Integer version) {
    }

    // -------------------------------------------------------------------------
    // 交付、业务验收与归档（需求 5.2.5）
    // -------------------------------------------------------------------------

    /**
     * 标记交付使用（需求 5.2.5 第 1 行）。一次调用推进交付标记与业务验收状态两个状态机，
     * 所以它不走统一转换接口——那个接口一次只推一个状态字段。
     */
    @WriteApi
    @PostMapping("/{id}/delivery")
    public R<Void> markDelivered(@PathVariable long id,
                                 @RequestParam(required = false) Integer version) {
        application.markDelivered(id, version);
        return R.ok(null);
    }

    /**
     * 录入验收结论（需求 5.2.5 第 2、3 行）。结论决定推到「验收通过」还是「验收不通过」。
     *
     * <p><b>出口二（造工具需求开发）的需求验收不通过后不会自动退回</b>：需求 5.2.5 说退到
     * 「开发中」，而 5.2.4 的转换表没有从「已上线」到「开发中」的通路，冲突待裁决（D-13）。
     * 在此之前需求停在「已上线」，运营按转换表自行推进。出口一按文档退回「已输出」。
     */
    @WriteApi
    @PostMapping("/{id}/acceptance-conclusion")
    public R<Long> recordAcceptanceConclusion(@PathVariable long id,
                                              @Valid @RequestBody DemandAcceptanceForm form) {
        return R.ok(application.recordAcceptanceConclusion(id, form));
    }

    /** 验收记录列表（详情页「业务验收」页签），最新一轮在前。 */
    @GetMapping("/{id}/acceptances")
    public R<List<DemandAcceptanceVO>> acceptances(@PathVariable long id) {
        return R.ok(acceptances.listByDemand(id).stream().map(DemandAcceptanceVO::of).toList());
    }

    // -------------------------------------------------------------------------
    // 关联课程（需求 8.4，规则 R1／R4）
    // -------------------------------------------------------------------------

    /** 需求详情页「关联课程」页签。同一份关联在课程详情页的「关联需求」页签里反向可见（R4）。 */
    @GetMapping("/{id}/courses")
    public R<List<DemandCourseLinkMapper.LinkedCourse>> courses(@PathVariable long id) {
        return R.ok(links.coursesOf(id));
    }

    /** 新增关联。重复关联静默成功（规则 K2）；带了新的关联说明则更新它。 */
    @WriteApi
    @PostMapping("/{id}/courses")
    public R<Void> linkCourse(@PathVariable long id, @Valid @RequestBody LinkRequest request) {
        links.link(id, request.courseId(), request.linkNote());
        return R.ok(null);
    }

    /** 解除关联。物理删除关联行，变更记入操作审计日志（开发 6.3.1）。 */
    @WriteApi
    @DeleteMapping("/{id}/courses/{courseId}")
    public R<Void> unlinkCourse(@PathVariable long id, @PathVariable long courseId) {
        links.unlink(id, courseId);
        return R.ok(null);
    }

    public record LinkRequest(
            @NotNull(message = "请选择要关联的课程")
            Long courseId,

            @Size(max = 200, message = "关联说明不超过 200 字")
            String linkNote) {
    }
}
