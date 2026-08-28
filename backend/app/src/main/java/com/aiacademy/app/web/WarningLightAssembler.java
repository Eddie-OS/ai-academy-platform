package com.aiacademy.app.web;

import com.aiacademy.aggregate.warning.domain.WarningLightView;
import com.aiacademy.aggregate.warning.service.WarningLightService;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 列表／详情 VO 装配灯色字段（阶段 3B）。计算在 warning 模块，VO 在 app（AR-4）。
 */
@Component
public class WarningLightAssembler {

    private final WarningLightService lights;

    public WarningLightAssembler(WarningLightService lights) {
        this.lights = lights;
    }

    public Map<Long, WarningLightView> index(String objectType, Collection<Long> ids) {
        List<WarningLightView> views = lights.calcMany(objectType, ids);
        return views.stream().collect(Collectors.toMap(
                WarningLightView::objectId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    public WarningLightView one(String objectType, long id) {
        return lights.calc(objectType, id);
    }
}
