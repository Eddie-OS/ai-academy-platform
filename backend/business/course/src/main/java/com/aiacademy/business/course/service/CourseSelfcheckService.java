package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.CourseSelfcheckItem;
import com.aiacademy.business.course.domain.CourseSelfcheckView;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.business.course.repository.CourseSelfcheckMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.dict.domain.SelfcheckItem;
import com.aiacademy.platform.dict.service.SelfcheckCatalog;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 课程自检 CheckList（需求 9.4）。
 *
 * <p><b>纯自评、无门禁、无不通过分支</b>（议题 13）。这里没有任何「未完成不许提交评审」的判断，
 * 也没有把完成度写进课程表——规则 CK3 明说未达 100% 时「弹提示但允许继续」，CK6 明说完成度
 * 不进指标、不参与三色灯。加了门禁会直接拦住运营录入历史数据（规则 C2）。
 *
 * <p>自检<b>子状态</b>（自检完成 / 空）不在这里改。它是需求 5.4.2 的状态机，走统一转换接口由
 * 运营手动置位——规则 C1：系统不做任何自动流转。勾满 14 条不会自动把子状态推成「自检完成」。
 */
@Service
public class CourseSelfcheckService {

    private final CourseSelfcheckMapper selfchecks;
    private final CourseMapper courses;
    private final SelfcheckCatalog items;

    public CourseSelfcheckService(CourseSelfcheckMapper selfchecks, CourseMapper courses,
                                  SelfcheckCatalog items) {
        this.selfchecks = selfchecks;
        this.courses = courses;
        this.items = items;
    }

    @Transactional(readOnly = true)
    public CourseSelfcheckView view(long courseId) {
        requireCourse(courseId);
        List<CourseSelfcheckItem> rows = selfchecks.findByCourse(courseId);
        // 分母只数启用中的条目（CK1、CK5）。停用的历史勾选照常展示，但不参与计数
        int total = (int) rows.stream().filter(CourseSelfcheckItem::enabled).count();
        int completed = (int) rows.stream()
                .filter(CourseSelfcheckItem::enabled)
                .filter(CourseSelfcheckItem::completed)
                .count();
        return new CourseSelfcheckView(courseId, total, completed, rows);
    }

    /**
     * 保存一批勾选结果（需求 9.4.2）。
     *
     * <p>逐条覆盖，没传的题目保持原样：自检页面是一题一题填的，一次全量提交会让两名运营同时
     * 填不同分组时互相清空对方的结果。
     *
     * @param answers 题目ID → 勾选结果
     */
    @Transactional
    public CourseSelfcheckView save(long courseId, List<Answer> answers) {
        requireCourse(courseId);
        Map<Long, SelfcheckItem> enabled = items.enabledItems().stream()
                .collect(Collectors.toMap(SelfcheckItem::id, Function.identity()));

        String operator = OperatorContext.current().account().name();
        for (Answer answer : answers) {
            SelfcheckItem item = enabled.get(answer.itemId());
            if (item == null) {
                // 停用或已删除的题目不接受新的勾选：CK5 只保证历史记录可查看，不是让它继续被填写
                throw new BizException(ErrorCode.PARAM_INVALID,
                        "自检清单项 %d 不存在或已停用".formatted(answer.itemId()));
            }
            if (SelfcheckItem.NOTE_NONE.equals(item.noteRequirement()) && notBlank(answer.note())) {
                throw new BizException(ErrorCode.PARAM_INVALID,
                        "「%s」是纯勾选题，不接受说明文本".formatted(item.itemText()));
            }
            selfchecks.save(courseId, item.id(), item.itemText(), answer.checked(),
                    blankToNull(answer.note()), operator);
        }
        return view(courseId);
    }

    /**
     * @param note 说明文本。规则 CK2：「必填」的条目勾了却没写说明<b>视为未完成</b>，
     *             但这里<b>不拒绝保存</b>——自检是边填边存的，填一半必须存得下去
     */
    public record Answer(long itemId, boolean checked, String note) {
    }

    private void requireCourse(long courseId) {
        if (courses.selectById(courseId) == null) {
            throw new NotFoundException("课程不存在或已删除：" + courseId);
        }
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String blankToNull(String value) {
        return notBlank(value) ? value.trim() : null;
    }
}
