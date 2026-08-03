package com.aiacademy.app.application;

import com.aiacademy.app.repository.ReportTrainingMetricsMapper;
import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.kase.domain.CaseReportForm;
import com.aiacademy.business.kase.repository.CaseReportMapper.CaseSectionMetrics;
import com.aiacademy.business.kase.service.CaseReportService;
import com.aiacademy.business.training.domain.TrainingEnums;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * 总结报告的自动生成（需求 12.6，AR-4：跨模块编排放 app 层）。
 *
 * <p>三个段落的数据分属两个模块：案例侧六个数字由 {@code CaseReportService} 取，培训侧四个由
 * {@code ReportTrainingMetricsMapper} 取。案例模块直接查培训表会绕开 AR-1 建立一条 ArchUnit
 * 看不见的依赖，因此拼装点只能在这里。
 *
 * <p><b>正文是 HTML 而不是 Markdown 或纯文本</b>：需求 12.6 说报告内容是富文本、自动生成后
 * 可编辑，而前端的富文本编辑器（wangEditor）吃的是 HTML。生成成别的格式，运营点开编辑的第一眼
 * 就是一堆转义符号。
 *
 * <p><b>不做「组织覆盖情况」段落。</b>V1.2 已删除（N12）——一期不导入组织架构，覆盖率没有分母。
 */
@Service
public class CaseReportApplicationService {

    private final CaseReportService reports;
    private final ReportTrainingMetricsMapper trainingMetrics;

    public CaseReportApplicationService(CaseReportService reports,
                                        ReportTrainingMetricsMapper trainingMetrics) {
        this.reports = reports;
        this.trainingMetrics = trainingMetrics;
    }

    /** 生成一份报告：按统计区间取数、拼正文、落库，生成方式记「系统自动生成」。 */
    @Transactional
    public long generate(CaseReportForm form) {
        String content = compose(form.periodStart(), form.periodEnd());
        return reports.create(form, content, CaseEnums.GENERATE_AUTO);
    }

    /**
     * 按区间重新取数并返回正文，<b>不落库</b>。
     *
     * <p>供「生成报告」弹窗在运营调整统计区间时实时预览。分成两个方法而不是让前端拿生成结果再
     * 提交一次，是因为落库的正文必须与落库的区间同源——让前端回传正文，改完区间忘了重新生成
     * 的那份就会带着旧数字存进去。
     */
    @Transactional(readOnly = true)
    public String preview(LocalDate from, LocalDate to) {
        return compose(from, to);
    }

    /**
     * 三个段落的正文（需求 12.6「自动生成的报告内容」）。
     *
     * <p>数字按设计规范 3.3 排版：整数用千分位，评分保留一位小数并带「/ 5」，<b>没有数据时写
     * 「—」而不是 0</b>——区间内一条反馈都没有和平均分是 0 分是两回事，后者根本不可能（评分
     * CHECK 是 1～5）。
     */
    private String compose(LocalDate from, LocalDate to) {
        CaseSectionMetrics kase = reports.caseMetrics(from, to);
        ReportTrainingMetricsMapper.TrainingSectionMetrics training = trainingMetrics.trainingMetrics(
                from, to, TrainingEnums.ATTEND_PRESENT, TrainingEnums.SCENE_FORMAL);

        StringBuilder html = new StringBuilder();
        html.append("<p>统计区间：").append(from).append(" 至 ").append(to).append("</p>");

        html.append("<h3>案例应用成果</h3><ul>")
                .append(li("新增案例数", count(kase.createdCases())))
                .append(li("上架案例数", count(kase.publishedCases())))
                // 标签由精品标注的取值拼出，而不是写死「精品案例数」：这一项数的是带精品
                // 标注的案例（需求 12.3 第 10 项），与课程主状态里那个同名的「精品案例」无关
                .append(li(CaseEnums.MARK_TOP + "案例数", count(kase.qualityCases())))
                .append(li("浏览次数", count(kase.viewCount())))
                .append(li("点赞量", count(kase.likeCount())))
                .append("</ul>");

        html.append("<h3>用户反馈</h3><ul>")
                .append(li("学员反馈条数", count(training.feedbackCount())))
                .append(li("案例评论条数", count(kase.commentCount())))
                .append("</ul>");

        html.append("<h3>培训执行情况</h3><ul>")
                .append(li("培训场次数", count(training.sessionCount())))
                .append(li("参训人次", count(training.attendeeCount())))
                .append(li("已参训人数（去重）", count(training.distinctPeople())))
                .append(li("平均讲师评分", score(training.avgScore())))
                .append("</ul>");

        return html.toString();
    }

    private static String li(String label, String value) {
        return "<li>" + label + "：" + value + "</li>";
    }

    /** 千分位。零值显示 {@code 0}——设计规范 3.3 规定 {@code —} 只用于「无数据」。 */
    private static String count(long value) {
        return String.format("%,d", value);
    }

    private static String score(Double value) {
        return value == null ? "—" : String.format("%.1f / 5", value);
    }
}
