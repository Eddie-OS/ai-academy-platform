package com.aiacademy.business.kase.controller;

import com.aiacademy.business.kase.domain.CaseComment;
import com.aiacademy.business.kase.domain.CaseCommentForm;
import com.aiacademy.business.kase.domain.CaseInteractionStats;
import com.aiacademy.business.kase.service.CaseInteractionService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.common.security.WriteAudience;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 案例互动：点赞、评论、停留时长（需求 12.4）。
 *
 * <p><b>为什么它在案例模块而不在 app 模块</b>，与本项目其余 Controller 的位置不同：点赞与评论是
 * 用户账号唯一的两个写接口（需求 6.2.5 第 6、7 项），而 ArchUnit 的 {@code e1_5} 配套断言把
 * {@link WriteAudience#USER_ALLOWED} 限定在 {@code business.kase} 包内——白名单只有落在这一个包里，
 * 「有人在别的模块给只读账号开了写口子」才会是一次编译期就能发现的越界。
 *
 * <p>这三个接口都不需要跨模块数据，因此放在这里不违反 AR-4：案例的增删改查与审核仍在
 * {@code app} 层的 {@code CaseController}，那些要读课程名、要推状态机。
 *
 * <p><b>没有「取消点赞」。</b>需求 12.3 第 18 项：累计计数，不去重、不可取消。界面上点赞按钮
 * 点击后也不变成「已点赞」——共享账号下系统无法判断当前使用者是否点过。
 */
@RestController
@RequestMapping("/api/cases/{caseId}")
public class CaseInteractionController {

    private final CaseInteractionService interactions;

    public CaseInteractionController(CaseInteractionService interactions) {
        this.interactions = interactions;
    }

    /**
     * 点赞（需求 6.2.5 第 6 项）。
     *
     * <p>返回是否真的记了一条：被防刷拦下时返回 {@code false} 而<b>不报错</b>（12.4：超出静默
     * 丢弃）。前端两种情况都按成功处理，计数刷新一下即可。
     */
    @WriteApi(WriteAudience.USER_ALLOWED)
    @PostMapping("/likes")
    public R<Boolean> like(@PathVariable long caseId) {
        return R.ok(interactions.like(caseId));
    }

    /** 发表评论（需求 6.2.5 第 7 项）。署名选填，留空由前端显示「匿名」。 */
    @WriteApi(WriteAudience.USER_ALLOWED)
    @PostMapping("/comments")
    public R<Void> comment(@PathVariable long caseId, @Valid @RequestBody CaseCommentForm form) {
        interactions.comment(caseId, form);
        return R.ok(null);
    }

    /** 评论列表，最新在前。读接口对两个账号无差异（纪律 PMI-2）。 */
    @GetMapping("/comments")
    public R<List<CaseComment>> comments(@PathVariable long caseId) {
        return R.ok(interactions.comments(caseId));
    }

    /**
     * 删除评论（需求 6.2.5 第 8 项）。<b>仅运营</b>——共享账号无法区分「自己的评论」与「他人的」，
     * 所以这一条不能跟着点赞与评论一起对用户账号开放。逻辑删除，评论数随之减一。
     */
    @WriteApi
    @DeleteMapping("/comments/{commentId}")
    public R<Void> deleteComment(@PathVariable long caseId, @PathVariable long commentId) {
        interactions.deleteComment(caseId, commentId);
        return R.ok(null);
    }

    /**
     * 回报停留时长（需求 12.3 第 21 项、12.4「停留时长上限」）。
     *
     * <p>{@code viewId} 来自详情接口返回的 {@code viewId}——浏览记录本身由那次读产生
     * （见 {@code CaseInteractionService.recordView} 的说明），这里只补上时长。
     *
     * <p><b>这是 {@code USER_ALLOWED} 的第三个接口，需求 6.2.5 的权限矩阵里没有对应行。</b>
     * 已记入 {@code docs/文档待修清单.md}。判断依据是它属于矩阵第 1 行「查看案例看板与详情」
     * 的产物而不是一项新能力：它既不能新建也不能删除任何东西，只能给一条<b>由请求方自己那次
     * 阅读产生的、时长还空着的</b>记录填上秒数。
     */
    @WriteApi(WriteAudience.USER_ALLOWED)
    @PatchMapping("/views/{viewId}")
    public R<Void> reportDuration(@PathVariable long caseId,
                                  @PathVariable long viewId,
                                  @RequestParam int seconds) {
        interactions.reportDuration(caseId, viewId, seconds);
        return R.ok(null);
    }

    /** 四项互动计数。点赞或评论后单独刷新用，省得把整个详情重新拉一遍。 */
    @GetMapping("/interactions")
    public R<CaseInteractionStats> stats(@PathVariable long caseId) {
        return R.ok(interactions.stats(caseId));
    }
}
