package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.CaseApplicationService;
import com.aiacademy.app.repository.CourseRefMapper;
import com.aiacademy.app.web.dto.CaseVO;
import com.aiacademy.business.kase.domain.CaseAuditForm;
import com.aiacademy.business.kase.domain.CaseForm;
import com.aiacademy.business.kase.domain.CaseListItem;
import com.aiacademy.business.kase.domain.CaseQuery;
import com.aiacademy.business.kase.service.CaseInteractionService;
import com.aiacademy.business.kase.service.CaseService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 案例看板、列表与详情（需求 12.3、12.7，页面 P5-1～P5-3）。
 *
 * <p><b>没有新建接口。</b>一期案例只有一个来源：课程标注达到精品标准时由 {@code CREATE_CASE}
 * 副作用自动创建（议题 27、C16-b、N10）。缺一个 {@code POST /api/cases} 是有意的。
 *
 * <p><b>点赞、评论与停留时长不在这里</b>，在 {@code business.kase.controller} 的
 * {@code CaseInteractionController}——那三个接口对用户账号开放，而 ArchUnit 把
 * {@code USER_ALLOWED} 限定在案例模块包内。
 *
 * <p><b>状态变更不在这里。</b>纯状态动作（开始整理、提交审核、下架修改）走统一转换接口
 * {@code POST /api/cases/{id}/transitions}（开发 7.4）；录入审核结论要同时写四个字段，
 * 走本类的专用接口。
 *
 * <p><b>附件与封面图也不在这里</b>（同 {@code TrainingArchiveController}）：前端用
 * {@code /api/attachments} 三段式上传拿到附件 ID 后挂到 {@code CASE} 上，{@code refField}
 * 取 {@code CaseService.REF_ATTACHMENTS} 或 {@code REF_COVER}。
 */
@RestController
@RequestMapping("/api/cases")
public class CaseController {

    private final CaseService cases;
    private final CaseApplicationService application;
    private final CaseInteractionService interactions;
    private final CourseRefMapper courses;

    public CaseController(CaseService cases, CaseApplicationService application,
                          CaseInteractionService interactions, CourseRefMapper courses) {
        this.cases = cases;
        this.application = application;
        this.interactions = interactions;
        this.courses = courses;
    }

    /**
     * 案例看板卡片流与运营列表页共用的查询（需求 12.7）。筛选条件全部可选。
     *
     * <p>读接口不做任何数据级过滤：一期两个账号的读权限完全无差异（纪律 PMI-2）。
     */
    @GetMapping
    public R<PageResult<CaseVO>> list(CaseQuery query) {
        PageResult<CaseListItem> page = cases.page(query);
        Map<Long, String> courseNames = courseNamesOf(page.records());
        return R.ok(new PageResult<>(
                page.records().stream()
                        .map(item -> CaseVO.of(item, courseNames.get(item.getCourseId())))
                        .toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }

    /**
     * 案例详情（页面 P5-3）。<b>每次调用记一条浏览记录</b>（需求 12.4：每次打开详情页记一条，
     * 不去重）。
     *
     * <p>浏览记录挂在读接口上而不是单开一个写接口，理由见
     * {@code CaseInteractionService.recordView}：需求 6.2.5 的权限矩阵里没有「记录浏览」这一行，
     * 它是第 1 行「查看案例看板与详情」的产物，那一行对两个账号都是 ✅。
     *
     * <p>返回体里的 {@code viewId} 供前端离开页面时回报停留时长。
     */
    @GetMapping("/{id}")
    public R<CaseVO> detail(@PathVariable long id) {
        CaseListItem item = cases.get(id);
        long viewId = interactions.recordView(id);
        String courseName = item.getCourseId() == null ? null : courseNameOf(item.getCourseId());
        return R.ok(CaseVO.of(item, courseName, viewId));
    }

    /**
     * 编辑案例内容（需求 6.2.5 第 2、5 项）。
     *
     * @param version 乐观锁版本号（规则 K1）。不传即按库里当前值更新，等于放弃冲突检测——
     *                前端应当始终回传详情里拿到的值
     */
    @WriteApi
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable long id,
                          @RequestParam(required = false) Integer version,
                          @Valid @RequestBody CaseForm form) {
        cases.update(id, form, version);
        return R.ok(null);
    }

    /** 逻辑删除（SEC2）。 */
    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        cases.softDelete(id);
        return R.ok(null);
    }

    /**
     * 录入审核结论（需求 6.2.5 第 4 项、需求 5.9 后两行）。
     *
     * <p>不走统一转换接口的原因同需求的评审结论：这里状态变更只是其中一步，拆成两次调用会让
     * 「已上架但没有审核人」的案例真实存在于两次请求之间——而 C9 把「上架前必须审核通过」
     * 列为三处硬阻断之一，一条没有审核人的已上架案例正是这条硬阻断要防的东西。
     *
     * <p>结论为「不通过」时案例退回「整理中」，审核字段照样留着，下一轮审核直接覆盖
     * （不记轮次，C09 第 4 条）。
     */
    @WriteApi
    @PostMapping("/{id}/audit")
    public R<Void> recordAudit(@PathVariable long id, @Valid @RequestBody CaseAuditForm form) {
        application.recordAudit(id, form);
        return R.ok(null);
    }

    /**
     * 批量取来源课程名称。
     *
     * <p>批量而非逐行：一页 20 张卡片就是 20 次查询，而这里一次就够。课程名从 app 层的
     * {@code CourseRefMapper} 取——案例模块不认识 {@code biz_course}（AR-1）。
     */
    private Map<Long, String> courseNamesOf(List<CaseListItem> items) {
        Set<Long> courseIds = items.stream()
                .map(CaseListItem::getCourseId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        if (courseIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> names = new LinkedHashMap<>();
        courses.findByIds(courseIds).forEach(ref -> names.put(ref.id(), ref.courseName()));
        return names;
    }

    private String courseNameOf(long courseId) {
        CourseRefMapper.CourseRef ref = courses.findById(courseId);
        return ref == null ? null : ref.courseName();
    }
}
