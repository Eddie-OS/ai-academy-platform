package com.aiacademy.app.skeleton.service;

import com.aiacademy.app.skeleton.domain.SampleStateCount;
import com.aiacademy.app.skeleton.domain.SkeletonSample;
import com.aiacademy.app.skeleton.repository.SkeletonSampleMapper;
import com.aiacademy.common.api.PageQuery;
import com.aiacademy.common.api.PageResult;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 骨架示例的服务层。
 *
 * <p>范本要点：<b>Service 层不出现任何 SQL</b>（规则 AR-5），
 * 也不出现任何判权逻辑（规则 AR-7、PMI-4）—— 判权由 {@code PermissionInterceptor} 一处完成。
 */
@Service
public class SkeletonSampleService {

    private final SkeletonSampleMapper mapper;

    public SkeletonSampleService(SkeletonSampleMapper mapper) {
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public PageResult<SkeletonSample> page(PageQuery query) {
        IPage<SkeletonSample> page = mapper.selectPage(
                new Page<>(query.getPageNum(), query.getPageSize()), null);
        return new PageResult<>(page.getRecords(), page.getTotal(),
                query.getPageNum(), query.getPageSize());
    }

    @Transactional(readOnly = true)
    public List<SampleStateCount> countByState() {
        return mapper.countByState();
    }

    /**
     * 写操作范本：创建时 {@code updated_at} 与 {@code last_state_changed_at} 同时置为入库时刻，
     * 此后二者各自独立演进（需求 C5、C6）。
     */
    @Transactional
    public SkeletonSample create(String sampleName, String operator) {
        OffsetDateTime now = OffsetDateTime.now();
        SkeletonSample sample = new SkeletonSample();
        sample.setSampleNo("SK-" + now.toInstant().toEpochMilli());
        sample.setSampleName(sampleName);
        sample.setSampleState("DRAFT");
        sample.setCreatedAt(now);
        sample.setCreatedBy(operator);
        sample.setUpdatedAt(now);
        sample.setUpdatedBy(operator);
        sample.setLastStateChangedAt(now);
        sample.setVersion(0);
        sample.setDeleted(false);
        mapper.insert(sample);
        return sample;
    }
}
