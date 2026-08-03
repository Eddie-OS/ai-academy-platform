package com.aiacademy.app.application.effect;

import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.platform.statemachine.domain.Effect;
import org.springframework.stereotype.Component;

/**
 * {@link Effect#SET_FIRST_PUBLISHED_AT}：课程首次进入「发布」时写首次发布时间，
 * 并按有效期时长算出截止日（需求 5.3.1 第 9 条、规则 EX1／EX3）。
 *
 * <p>「首次」的判断在 SQL 的 {@code WHERE first_publish_date IS NULL} 里，不在这里：课程从
 * 「优化」回到「发布」会再次触发本效果，而 EX2 规定首次发布时间只写一次——它是课程开发周期
 * （需求 15.2）的终点，重算会把这个指标变成「最后一次发布用了多久」。
 */
@Component
public class FirstPublishEffectHandler implements EffectHandler {

    private final CourseService courses;

    public FirstPublishEffectHandler(CourseService courses) {
        this.courses = courses;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.SET_FIRST_PUBLISHED_AT.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        courses.markFirstPublished(context.objectId());
    }
}
