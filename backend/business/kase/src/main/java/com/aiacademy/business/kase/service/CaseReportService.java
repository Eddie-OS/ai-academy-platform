package com.aiacademy.business.kase.service;

import com.aiacademy.business.kase.domain.CaseEnums;
import com.aiacademy.business.kase.domain.CaseReport;
import com.aiacademy.business.kase.domain.CaseReportForm;
import com.aiacademy.business.kase.repository.CaseReportMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 总结报告的增删改查与案例侧取数（需求 12.6，页面 P5-4）。
 *
 * <p><b>正文的拼装不在这里。</b>12.6 的四个段落里有一段要数培训场次、参训人次与讲师评分，
 * 那三张表属培训模块，跨模块编排按 AR-4 归 app 层的 {@code CaseReportApplicationService}。
 * 本类只提供案例侧的六个数字与落库。
 */
@Service
public class CaseReportService {

    private final CaseReportMapper mapper;

    public CaseReportService(CaseReportMapper mapper) {
        this.mapper = mapper;
    }

    /** 12.6「案例应用成果」与「用户反馈」两段里属案例侧的六个数字。 */
    @Transactional(readOnly = true)
    public CaseReportMapper.CaseSectionMetrics caseMetrics(LocalDate from, LocalDate to) {
        return mapper.caseMetrics(from, to, CaseEnums.MARK_TOP);
    }

    /**
     * 落库一份新报告。
     *
     * @param content      正文。由应用服务按统计区间拼好后传进来
     * @param generateMode 生成方式，见 {@link CaseEnums#GENERATE_MODES}
     */
    @Transactional
    public long create(CaseReportForm form, String content, String generateMode) {
        requirePeriod(form);
        return mapper.insert(form.reportName().trim(), form.periodStart(), form.periodEnd(),
                generateMode, content, operator());
    }

    /**
     * 编辑报告。<b>生成方式一并转为「手动编辑」</b>（需求 12.6）。
     *
     * <p>这不是可选项：一份被改过的报告如果还标着「系统自动生成」，读它的人会以为里面的数字
     * 都是系统算的，而其中某个可能已经被手工改过。
     */
    @Transactional
    public void update(long id, CaseReportForm form) {
        requirePeriod(form);
        requireExisting(id);
        mapper.update(id, form.reportName().trim(), form.periodStart(), form.periodEnd(),
                form.content(), CaseEnums.GENERATE_MANUAL, operator());
    }

    @Transactional
    public void softDelete(long id) {
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("总结报告不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public CaseReport get(long id) {
        return requireExisting(id);
    }

    @Transactional(readOnly = true)
    public List<CaseReport> list() {
        return mapper.findAll();
    }

    private CaseReport requireExisting(long id) {
        CaseReport report = mapper.findById(id);
        if (report == null) {
            throw new NotFoundException("总结报告不存在或已删除：" + id);
        }
        return report;
    }

    /**
     * 区间的止日不得早于起日。
     *
     * <p>这一条是取值合法性而不是业务前置条件（规则 C2 管的是后者）：区间倒过来时四个段落的
     * 取数一律返回 0，而报告看起来完全正常——运营只会觉得「这个季度什么都没发生」。
     */
    private static void requirePeriod(CaseReportForm form) {
        if (form.periodEnd().isBefore(form.periodStart())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "统计区间的结束日期不能早于开始日期：%s ~ %s"
                            .formatted(form.periodStart(), form.periodEnd()));
        }
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
