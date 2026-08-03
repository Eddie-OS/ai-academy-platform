package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.CaseReportApplicationService;
import com.aiacademy.app.web.dto.CaseReportVO;
import com.aiacademy.business.kase.domain.CaseReportForm;
import com.aiacademy.business.kase.service.CaseReportService;
import com.aiacademy.common.api.R;
import com.aiacademy.common.security.WriteApi;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 总结报告（需求 12.6，页面 P5-4）。生成与编辑仅运营，用户账号只读（需求 6.2.5 第 9 项）。
 *
 * <p>报告正文按统计区间自动生成三个段落，运营可编辑后保存；<b>一经编辑，生成方式即转为
 * 「手动编辑」</b>——读报告的人有权知道眼前的数字还是不是系统口径。
 *
 * <p><b>没有「组织覆盖情况」段落</b>（N12）：一期不导入组织架构，覆盖率没有分母。
 */
@RestController
@RequestMapping("/api/case-reports")
public class CaseReportController {

    private final CaseReportService reports;
    private final CaseReportApplicationService application;

    public CaseReportController(CaseReportService reports,
                                CaseReportApplicationService application) {
        this.reports = reports;
        this.application = application;
    }

    /** 报告列表，最新在前。报告是几十条量级，不分页。 */
    @GetMapping
    public R<List<CaseReportVO>> list() {
        return R.ok(reports.list().stream().map(CaseReportVO::of).toList());
    }

    @GetMapping("/{id}")
    public R<CaseReportVO> detail(@PathVariable long id) {
        return R.ok(CaseReportVO.of(reports.get(id)));
    }

    /**
     * 按统计区间取数并返回正文，<b>不落库</b>。供生成弹窗在运营调整区间时实时预览。
     *
     * <p>预览与生成分成两个接口、正文都由后端算，是为了让落库的正文与落库的区间同源：让前端
     * 把预览到的正文回传，改完区间忘了重新预览的那一份就会带着旧数字存进去。
     */
    @GetMapping("/preview")
    public R<String> preview(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                             @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return R.ok(application.preview(from, to));
    }

    /** 生成报告（需求 12.6）。正文由后端按区间填四个段落，生成方式记「系统自动生成」。 */
    @WriteApi
    @PostMapping
    public R<Long> generate(@Valid @RequestBody CaseReportForm form) {
        return R.ok(application.generate(form));
    }

    /** 编辑报告。生成方式随之转为「手动编辑」。 */
    @WriteApi
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable long id, @Valid @RequestBody CaseReportForm form) {
        reports.update(id, form);
        return R.ok(null);
    }

    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        reports.softDelete(id);
        return R.ok(null);
    }
}
