package com.aiacademy.platform.dataimport.service;

import com.aiacademy.platform.dataimport.repository.ImportBatchMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 把「确认时重新校验失败」这件事记进批次，<b>用一个独立事务</b>。
 *
 * <p>为什么不能写在 {@code ImportService.confirm} 自己的事务里：那个方法记完失败要抛异常，
 * 异常会把同一个事务里的这条记录一起回滚掉。结果是运营看到报错，批次列表却仍显示「待确认」、
 * 错误报告的路径也没落库——运营只能反复点确认反复失败，而平台一次都没留痕。
 *
 * <p>{@code REQUIRES_NEW} 必须放在另一个 Bean 上：同类内部调用走不到 Spring 代理，
 * 注解会被静默忽略，那正是这个类存在的唯一理由。
 */
@Component
public class ImportFailureRecorder {

    private final ImportBatchMapper batches;

    public ImportFailureRecorder(ImportBatchMapper batches) {
        this.batches = batches;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordValidationFailure(String batchNo, int totalRows, String errorReportPath, String operator) {
        batches.markValidationFailed(batchNo, totalRows, errorReportPath, operator);
    }
}
