package com.aiacademy.app.application;

import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseRecordStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST 路径段与状态机对象类型的对照表，服务于 {@code /api/{objectType}/{id}/transitions}
 * （《开发实施文档》7.4）。
 *
 * <p>路径段按规则 API-1 用<b>复数英文小写连字符</b>，对象类型用状态机注册表里的大写下划线码。
 * 两者不能合成一个：URL 里出现 {@code COURSE_REVIEW} 违反 API-1，而状态机侧改成
 * {@code course-reviews} 会让 16 张转换表与需求 5.11 的对象类型枚举对不上。
 *
 * <p>本表<b>不是新的真相来源</b>：{@link #verifyCoversAllObjectTypes()} 拿
 * {@link StateObjectMappings} 逐个核对，漏登记一个对象类型就在启动时失败——
 * 否则漏登记的表现是「某个对象的状态转换接口 404」，而 404 看起来像是前端路径写错了。
 */
public final class ObjectTypeRoutes {

    private static final Map<String, String> OBJECT_TYPE_BY_SEGMENT = new LinkedHashMap<>();
    private static final Map<String, String> SEGMENT_BY_OBJECT_TYPE = new LinkedHashMap<>();

    static {
        register("demands", DemandStateMachines.OBJECT_TYPE);
        register("courses", CourseStateMachines.OBJECT_TYPE);
        register("course-reviews", CourseRecordStateMachines.REVIEW_OBJECT_TYPE);
        register("course-trials", CourseRecordStateMachines.TRIAL_OBJECT_TYPE);
        register("training-plans", TrainingStateMachines.PLAN_OBJECT_TYPE);
        register("training-sessions", TrainingStateMachines.SESSION_OBJECT_TYPE);
        register("cases", CaseStateMachines.OBJECT_TYPE);
        register("tasks", TaskStateMachine.OBJECT_TYPE);
        verifyCoversAllObjectTypes();
    }

    private ObjectTypeRoutes() {
    }

    private static void register(String segment, String objectType) {
        OBJECT_TYPE_BY_SEGMENT.put(segment, objectType);
        SEGMENT_BY_OBJECT_TYPE.put(objectType, segment);
    }

    private static void verifyCoversAllObjectTypes() {
        StateObjectMappings.all().stream()
                .map(mapping -> mapping.objectType())
                .filter(objectType -> !SEGMENT_BY_OBJECT_TYPE.containsKey(objectType))
                .findFirst()
                .ifPresent(missing -> {
                    throw new IllegalStateException("对象类型 %s 有状态列映射却没有 REST 路径段，"
                            .formatted(missing) + "补一行 register(...) 即可");
                });
    }

    /**
     * 路径段翻对象类型。
     *
     * <p>未登记的段抛 {@code NOT_FOUND} 而不是 {@code PARAM_INVALID}：从调用方看
     * {@code /api/foo/1/transitions} 就是一个不存在的资源。
     */
    public static String requireObjectType(String segment) {
        String objectType = OBJECT_TYPE_BY_SEGMENT.get(segment);
        if (objectType == null) {
            throw new NotFoundException("没有「%s」这类对象的状态转换接口，可用的是：%s"
                    .formatted(segment, String.join("、", OBJECT_TYPE_BY_SEGMENT.keySet())));
        }
        return objectType;
    }

    public static String segmentOf(String objectType) {
        String segment = SEGMENT_BY_OBJECT_TYPE.get(objectType);
        if (segment == null) {
            throw new IllegalStateException("对象类型 " + objectType + " 没有登记 REST 路径段");
        }
        return segment;
    }

    public static Map<String, String> all() {
        return Map.copyOf(OBJECT_TYPE_BY_SEGMENT);
    }
}
