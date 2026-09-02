package com.aiacademy.app.web.controller;

import com.aiacademy.app.application.LecturerApplicationService;
import com.aiacademy.app.repository.LecturerBoardMapper;
import com.aiacademy.app.web.dto.CertificationRecordVO;
import com.aiacademy.app.web.dto.CultivationRecordVO;
import com.aiacademy.app.web.dto.LecturerFieldLogVO;
import com.aiacademy.app.web.dto.LecturerVO;
import com.aiacademy.app.web.dto.LevelLogRecordVO;
import com.aiacademy.app.web.dto.TrialLedgerQuery;
import com.aiacademy.app.repository.TrialLedgerMapper;
import com.aiacademy.business.lecturer.domain.CertificationForm;
import com.aiacademy.business.lecturer.domain.CultivationForm;
import com.aiacademy.business.lecturer.domain.LecturerForm;
import com.aiacademy.business.lecturer.domain.LevelLogForm;
import com.aiacademy.business.lecturer.domain.LecturerListItem;
import com.aiacademy.business.lecturer.domain.LecturerQuery;
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

import java.util.List;

/**
 * 讲师池、讲师详情与试讲台账（需求第 10 章，页面 P3-1／P3-2／P3-3）。
 *
 * <p><b>没有状态转换接口。</b>讲师的培养状态与在池状态都不是状态机（规则 TS1、C10、需求 5.13），
 * 改值走 {@code PUT /api/lecturers/{id}}，只写操作审计日志、不写状态流转日志（TS2）。
 * 这是讲师模块与其他四个驾驶舱最大的结构差异。
 *
 * <p><b>没有判权代码。</b>写接口一律带 {@code @WriteApi}，判定由 {@code PermissionInterceptor}
 * 一处完成（AR-7、PMI-1）。讲师没有 owner 字段，连误用 {@code owner_no} 判权的机会都没有。
 */
@RestController
@RequestMapping("/api/lecturers")
public class LecturerController {

    private final LecturerApplicationService lecturers;

    public LecturerController(LecturerApplicationService lecturers) {
        this.lecturers = lecturers;
    }

    /** 运营手动添加讲师（需求 10.4 第 2 行）。入池方式与入池时间由这条路径决定，不从表单来。 */
    @WriteApi
    @PostMapping
    public R<Long> create(@Valid @RequestBody LecturerForm form) {
        return R.ok(lecturers.createManually(form));
    }

    /**
     * 编辑讲师，含培养状态与在池状态改值。
     *
     * <p>没有 version 参数：讲师不在带 {@code version} 的三张表里（规则 K1）。
     */
    @WriteApi
    @PutMapping("/{id}")
    public R<Void> update(@PathVariable long id, @Valid @RequestBody LecturerForm form) {
        lecturers.update(id, form);
        return R.ok(null);
    }

    /** 逻辑删除（SEC2）。已被场次或试讲引用时拒绝，理由见应用服务。 */
    @WriteApi
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable long id) {
        lecturers.softDelete(id);
        return R.ok(null);
    }

    /** 讲师池列表（需求 10.7）。筛选条件全部可选，一个都不传即全量分页。 */
    @GetMapping
    public R<PageResult<LecturerVO>> list(LecturerQuery query) {
        PageResult<LecturerListItem> page = lecturers.page(query);
        return R.ok(new PageResult<>(page.records().stream().map(LecturerVO::of).toList(),
                page.total(), page.pageNum(), page.pageSize()));
    }

    @GetMapping("/{id}")
    public R<LecturerVO> detail(@PathVariable long id) {
        return R.ok(LecturerVO.of(lecturers.detail(id)));
    }

    /** 授课记录页签（需求 10.5）。实时从培训场次派生，理由见 {@code LecturerBoardMapper}。 */
    @GetMapping("/{id}/teaching-records")
    public R<List<LecturerBoardMapper.TeachingRecordRow>> teachingRecords(@PathVariable long id) {
        return R.ok(lecturers.teachingRecords(id));
    }

    /** 学员评价页签（需求 10.6）。数据源是学员反馈，试讲反馈不计入（规则 R10）。 */
    @GetMapping("/{id}/evaluations")
    public R<List<LecturerBoardMapper.EvaluationRow>> evaluations(@PathVariable long id) {
        return R.ok(lecturers.evaluations(id));
    }

    /**
     * 来源部门的去重清单，供筛选下拉用。
     *
     * <p>V1.2 把来源部门改成自由文本（N18），没有部门表可查——列出库里已有的取值是唯一办法。
     */
    @GetMapping("/source-depts")
    public R<List<String>> sourceDepts() {
        return R.ok(lecturers.sourceDepts());
    }

    /**
     * 试讲台账（需求 10.2 页面 P3-3）：全部课程的试讲记录汇总。
     *
     * <p>挂在 {@code /api/lecturers} 下而不是单开一个资源：它是讲师驾驶舱的第三个视图，
     * 与讲师详情页的试讲记录看的是同一批数据。
     */
    @GetMapping("/trial-ledger")
    public R<PageResult<TrialLedgerMapper.TrialLedgerRow>> trialLedger(TrialLedgerQuery query) {
        return R.ok(lecturers.trialLedger(query));
    }

    @GetMapping("/{id}/cultivation-records")
    public R<List<CultivationRecordVO>> cultivationRecords(@PathVariable long id) {
        return R.ok(lecturers.cultivationRecords(id).stream().map(CultivationRecordVO::of).toList());
    }

    @WriteApi
    @PostMapping("/{id}/cultivation-records")
    public R<Long> createCultivation(@PathVariable long id, @Valid @RequestBody CultivationForm form) {
        return R.ok(lecturers.createCultivation(id, form));
    }

    @WriteApi
    @PutMapping("/{id}/cultivation-records/{recordId}")
    public R<Void> updateCultivation(@PathVariable long id,
                                     @PathVariable long recordId,
                                     @Valid @RequestBody CultivationForm form) {
        lecturers.updateCultivation(id, recordId, form);
        return R.ok(null);
    }

    @WriteApi
    @DeleteMapping("/{id}/cultivation-records/{recordId}")
    public R<Void> deleteCultivation(@PathVariable long id, @PathVariable long recordId) {
        lecturers.removeCultivation(id, recordId);
        return R.ok(null);
    }

    @GetMapping("/{id}/field-logs")
    public R<List<LecturerFieldLogVO>> fieldLogs(@PathVariable long id) {
        return R.ok(lecturers.statusFieldLogs(id).stream().map(LecturerFieldLogVO::of).toList());
    }

    @GetMapping("/{id}/certification-records")
    public R<List<CertificationRecordVO>> certificationRecords(@PathVariable long id) {
        return R.ok(lecturers.certificationRecords(id).stream().map(CertificationRecordVO::of).toList());
    }

    @WriteApi
    @PostMapping("/{id}/certification-records")
    public R<Long> createCertification(@PathVariable long id, @Valid @RequestBody CertificationForm form) {
        return R.ok(lecturers.createCertification(id, form));
    }

    @WriteApi
    @PutMapping("/{id}/certification-records/{recordId}")
    public R<Void> updateCertification(@PathVariable long id,
                                       @PathVariable long recordId,
                                       @Valid @RequestBody CertificationForm form) {
        lecturers.updateCertification(id, recordId, form);
        return R.ok(null);
    }

    @WriteApi
    @DeleteMapping("/{id}/certification-records/{recordId}")
    public R<Void> deleteCertification(@PathVariable long id, @PathVariable long recordId) {
        lecturers.removeCertification(id, recordId);
        return R.ok(null);
    }

    @GetMapping("/{id}/level-logs")
    public R<List<LevelLogRecordVO>> levelLogs(@PathVariable long id) {
        return R.ok(lecturers.listLevelLogs(id).stream().map(LevelLogRecordVO::of).toList());
    }

    @WriteApi
    @PostMapping("/{id}/level-logs")
    public R<Long> createLevelLog(@PathVariable long id, @Valid @RequestBody LevelLogForm form) {
        return R.ok(lecturers.createLevelLog(id, form));
    }

    @WriteApi
    @PutMapping("/{id}/level-logs/{recordId}")
    public R<Void> updateLevelLog(@PathVariable long id,
                                  @PathVariable long recordId,
                                  @Valid @RequestBody LevelLogForm form) {
        lecturers.updateLevelLog(id, recordId, form);
        return R.ok(null);
    }

    @WriteApi
    @DeleteMapping("/{id}/level-logs/{recordId}")
    public R<Void> deleteLevelLog(@PathVariable long id, @PathVariable long recordId) {
        lecturers.removeLevelLog(id, recordId);
        return R.ok(null);
    }
}
