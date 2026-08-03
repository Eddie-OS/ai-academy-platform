package com.aiacademy.platform.dict.service;

import com.aiacademy.platform.dict.domain.SelfcheckItem;
import com.aiacademy.platform.dict.repository.SelfcheckItemMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 自检题库的<b>只读</b>视图，供课程自检页面使用（需求 9.4.2）。
 *
 * <p>与 {@link SelfcheckConfigService} 分开的原因是消费方向不同：那个是配置中心的写服务，
 * 带审计快照与一串「锁定条目不许停用」之类的写侧规则；课程侧只需要「现在还在启用的题目有哪些」。
 * 让课程模块去依赖一个写服务，等于把配置中心的写规则也拖进课程的依赖里。
 */
@Service
public class SelfcheckCatalog {

    private final SelfcheckItemMapper items;

    public SelfcheckCatalog(SelfcheckItemMapper items) {
        this.items = items;
    }

    /**
     * 启用中的题目，按分组与排序号。
     *
     * <p>停用的题目不在这里：规则 CK5 只保证历史勾选仍可查看，不是让停用题继续被填写。
     */
    @Transactional(readOnly = true)
    public List<SelfcheckItem> enabledItems() {
        return items.findAll().stream().filter(SelfcheckItem::enabled).toList();
    }
}
