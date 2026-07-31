package com.aiacademy.common.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 权限注解：声明一个写接口（POST／PUT／PATCH／DELETE）对谁开放。出口准则 E1-5 要求
 * <b>全部写接口都带这个注解</b>，由 ArchUnit 断言，判定由 {@code PermissionInterceptor} 一处完成。
 *
 * <p><b>为什么要注解，而不是让拦截器按路径判断。</b>判定式本身很简单（运营才能写，规则 PM1），
 * 拦截器只看 HTTP 方法就够用。真正的问题在那两个例外上：点赞与评论的白名单如果写成
 * 拦截器里的路径字符串集合，路径一改（比如 {@code /api/cases/{id}/likes} 改成
 * {@code /api/cases/{caseId}/likes}），集合不再匹配，白名单<b>静默失效</b>——用户账号点不了赞，
 * 而没有任何编译错误和测试失败。注解跟着代码走，改路径不会让它掉队。
 *
 * <p>反过来，注解也让「新增了一个写接口但忘了想清楚谁能用」变成一个会红的测试，
 * 而不是一个默认放行给运营的既成事实。
 *
 * <p>不带注解的写接口在运行时<b>一律拒绝</b>（纪律 PMI-1「默认拒绝」）并打 ERROR 日志：
 * 漏注解是代码缺陷，不能表现成「碰巧能用」。
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface WriteApi {

    /** 默认仅运营账号，与需求 6.2 权限矩阵的默认行一致。 */
    WriteAudience value() default WriteAudience.OPERATOR_ONLY;
}
