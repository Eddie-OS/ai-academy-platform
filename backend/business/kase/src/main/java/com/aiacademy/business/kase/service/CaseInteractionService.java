package com.aiacademy.business.kase.service;

import com.aiacademy.business.kase.domain.CaseComment;
import com.aiacademy.business.kase.domain.CaseCommentForm;
import com.aiacademy.business.kase.domain.CaseInteractionStats;
import com.aiacademy.business.kase.repository.CaseInteractionMapper;
import com.aiacademy.business.kase.repository.CaseMapper;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 浏览、点赞、评论三类互动（需求 12.4）。
 *
 * <p><b>整节按共享账号模型重写过，凡依赖个人身份的去重与防重复逻辑全部取消</b>。三条最容易被
 * 「好心纠正」的规则：
 *
 * <ul>
 *   <li><b>浏览不去重</b>。V1.1 的「同一人同一天只计 1 次」在共享账号下无法实现——系统不知道
 *       是谁。因此浏览次数的含义是「被打开了多少次」而不是「多少人看过」，指标名也相应从
 *       「阅读量」改成了「浏览次数」。
 *   <li><b>点赞不去重、不可取消</b>。同一账号可反复点赞，每次都计数；界面上点赞按钮点击后
 *       <b>不变成「已点赞」</b>，因为系统无法判断当前使用者是否点过。不要补一个 unlike 接口。
 *   <li><b>评论只有运营能删</b>，且是逻辑删除。用户账号一律不能删——系统无法判断哪条是
 *       「自己的」。判定在 {@code PermissionInterceptor} 一处，不在这里（AR-7）。
 * </ul>
 */
@Service
public class CaseInteractionService {

    private static final Logger log = LoggerFactory.getLogger(CaseInteractionService.class);

    /**
     * 单次停留时长的上限（需求 12.4）：超过 30 分钟按 30 分钟计。
     *
     * <p>防的是页面挂在浏览器里过夜——一条 8 小时的浏览记录会把「平均阅读时长」整个指标毁掉，
     * 而那个数字看起来只是「有点高」，不会有人怀疑它。
     */
    static final int MAX_DURATION_SECONDS = 30 * 60;

    /** 点赞防刷（需求 12.4）：同一 IP 对同一案例每分钟最多 5 次，超出<b>静默丢弃</b>。 */
    static final int LIKE_LIMIT_PER_MINUTE = 5;

    private final CaseInteractionMapper interactions;
    private final CaseMapper cases;

    public CaseInteractionService(CaseInteractionMapper interactions, CaseMapper cases) {
        this.interactions = interactions;
        this.cases = cases;
    }

    /**
     * 记一条浏览（需求 12.4 第 1 行）。由详情读接口调用，每打开一次记一条。
     *
     * <p><b>它挂在读接口上而不是单开一个写接口</b>，因为需求 6.2.5 把「查看案例看板与详情」
     * 对两个账号都开放（第 1 行），而浏览记录是这个动作的产物，不是一项独立的写操作——那张
     * 权限矩阵里从头到尾没有「记录浏览」这一行。做成写接口就必须给只读账号再开一个写口子。
     *
     * @return 浏览记录主键，供离开页面时回报停留时长
     */
    @Transactional
    public long recordView(long caseId) {
        requireCase(caseId);
        return interactions.insertView(caseId, accountType(), sourceIp());
    }

    /**
     * 回报停留时长（需求 12.3 第 21 项）。同一条记录只接受第一次回报，见 Mapper 的说明。
     *
     * <p>找不到记录时<b>静默返回</b>：这是页面卸载时发出的请求，案例可能刚被删、记录可能已经
     * 报过一次。为此报错只会在浏览器控制台里留下一片红，而它对使用者没有任何意义。
     */
    @Transactional
    public void reportDuration(long caseId, long viewId, int durationSeconds) {
        Integer capped = cap(durationSeconds);
        if (capped == null) {
            return;
        }
        interactions.updateViewDuration(caseId, viewId, capped);
    }

    /**
     * 点赞（需求 12.4 第 2 行）。用户账号也能调（需求 6.2.5）。
     *
     * <p>被防刷拦下时<b>不报错，返回 false</b>：需求 12.4 写的是「超出静默丢弃」。给刷子一个
     * 明确的「你被限流了」等于告诉他隔一分钟再来；而正常使用者一分钟内点第 6 次的情况本就不存在，
     * 弹一个错误提示只会让他困惑。
     *
     * @return 是否真的记了一条
     */
    @Transactional
    public boolean like(long caseId) {
        requireCase(caseId);
        String ip = sourceIp();

        // 取不到 IP 时不限流：宁可少拦，也不要把整栋楼出口 IP 相同的使用者当成一个人
        if (ip != null && interactions.countRecentLikes(caseId, ip) >= LIKE_LIMIT_PER_MINUTE) {
            log.info("案例 {} 来自 {} 的点赞在一分钟内超过 {} 次，按需求 12.4 静默丢弃",
                    caseId, ip, LIKE_LIMIT_PER_MINUTE);
            return false;
        }
        interactions.insertLike(caseId, accountType(), ip);
        return true;
    }

    /** 发表评论（需求 12.4 第 3 行）。用户账号也能调（需求 6.2.5）。 */
    @Transactional
    public void comment(long caseId, CaseCommentForm form) {
        requireCase(caseId);
        // 署名留空落 null 而不是「匿名」：写死字符串之后，「没填署名」和「署名真的叫匿名」
        // 再也分不开，而显示成「匿名」是展示层的事
        String signature = form.signature() == null || form.signature().isBlank()
                ? null : form.signature().trim();
        interactions.insertComment(caseId, accountType(), signature, form.content().trim(), operator());
    }

    @Transactional(readOnly = true)
    public List<CaseComment> comments(long caseId) {
        return interactions.findComments(caseId);
    }

    /** 删除评论。<b>仅运营</b>（需求 12.4 末行），判定在拦截器一处完成。 */
    @Transactional
    public void deleteComment(long caseId, long commentId) {
        if (interactions.softDeleteComment(caseId, commentId, operator()) == 0) {
            throw new NotFoundException("评论不存在或已删除：" + commentId);
        }
    }

    @Transactional(readOnly = true)
    public CaseInteractionStats stats(long caseId) {
        return interactions.stats(caseId);
    }

    /**
     * 上限截断（需求 12.4「停留时长上限」）。负值与 null 一律丢弃，不落 0——「平均阅读时长」
     * 被一堆 0 秒记录拉低之后，那个数字看上去只是有点低，没人会怀疑到这里。
     */
    private static Integer cap(Integer durationSeconds) {
        if (durationSeconds == null || durationSeconds <= 0) {
            return null;
        }
        return Math.min(durationSeconds, MAX_DURATION_SECONDS);
    }

    private void requireCase(long caseId) {
        if (cases.selectById(caseId) == null) {
            throw new NotFoundException("案例不存在或已删除：" + caseId);
        }
    }

    /**
     * 账号类型（OPS / USER / SYSTEM），取值与两张审计日志同一套。
     *
     * <p>这不是判权：{@code OperatorAccount} 是留痕用的枚举，与 {@code AccountType} 刻意分开
     * （见 {@code OperatorAccount} 的类注释）。这里只是把「谁点的赞」记下来，不据此决定能不能点
     * ——那由 {@code PermissionInterceptor} 一处判定（AR-7）。
     */
    private static String accountType() {
        return OperatorContext.current().account().name();
    }

    private static String sourceIp() {
        String ip = OperatorContext.current().ip();
        return ip == null || ip.isBlank() || "-".equals(ip) ? null : ip;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
