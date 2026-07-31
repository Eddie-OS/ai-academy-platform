package com.aiacademy.architecture;

import com.aiacademy.common.security.AccountType;
import com.aiacademy.common.security.WriteApi;
import com.aiacademy.common.security.WriteAudience;
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.lang.annotation.Annotation;
import java.util.List;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

/**
 * 架构约束的可执行版本，对应《开发实施文档》4.2.2 的 AR-1～AR-7 与第 1.6 节「一期不做的 18 项」。
 *
 * <p><b>在全程 AI 编码的模式下这不是可选项。</b>AI 生成代码时很容易跨模块直接调用，
 * 人工评审不可能每次都看全；这些断言是 CI 门禁，违规提交会被直接拦下（出口准则 E0-3）。
 *
 * <p>每条断言的失败信息都指向文档规则号，便于下一次会话直接定位依据。
 */
class ArchitectureRulesTest {

    private static final String ROOT = "com.aiacademy";

    /** 写映射注解全集。{@code @RequestMapping(method = POST)} 这种写法本项目不用（API-1 用专用注解）。 */
    private static final List<Class<? extends Annotation>> WRITE_MAPPINGS =
            List.of(PostMapping.class, PutMapping.class, PatchMapping.class, DeleteMapping.class);

    private static JavaClasses classesUnderTest;

    @BeforeAll
    static void importClasses() {
        // 15 个领域模块在 app 的测试运行时classpath上是 jar，因此不能加 DoNotIncludeJars，
        // 否则只会扫到 app 自己的类，断言看起来全绿但什么都没检查。
        classesUnderTest = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages(ROOT);
    }

    // -------------------------------------------------------------------------
    // AR-1 业务模块之间禁止直接依赖
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-1：业务模块之间禁止直接依赖，跨模块关系走应用服务或领域事件")
    void ar1_businessModulesMustNotDependOnEachOther() {
        String[] businessModules = {"demand", "course", "lecturer", "training", "kase"};

        for (String module : businessModules) {
            String self = ROOT + ".business." + module + "..";
            String[] others = otherBusinessPackages(businessModules, module);

            noClasses().that().resideInAPackage(self)
                    .should().dependOnClassesThat().resideInAnyPackage(others)
                    .because("AR-1：业务模块 " + module
                            + " 不得 import 其他业务模块的类。需求↔课程这类跨模块关系放在 "
                            + ROOT + ".app.application 的应用服务里编排（AR-4）")
                    // 5 个业务模块到阶段 2 才有类。届时删掉这一行——那时它才真正开始检查东西
                    .allowEmptyShould(true)
                    .check(classesUnderTest);
        }
    }

    private String[] otherBusinessPackages(String[] all, String self) {
        return java.util.Arrays.stream(all)
                .filter(m -> !m.equals(self))
                .map(m -> ROOT + ".business." + m + "..")
                .toArray(String[]::new);
    }

    // -------------------------------------------------------------------------
    // AR-2 平台模块不得依赖业务模块
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-2：平台模块不得依赖业务模块、聚合模块与 app，依赖方向永远是业务→平台")
    void ar2_platformMustNotDependOnBusiness() {
        noClasses().that().resideInAPackage(ROOT + ".platform..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        ROOT + ".business..",
                        ROOT + ".aggregate..",
                        ROOT + ".app..")
                .because("AR-2：平台模块被业务模块复用，一旦反向依赖，状态机引擎就会被某个具体业务污染")
                .check(classesUnderTest);
    }

    @Test
    @DisplayName("AR-2 延伸：common 不得依赖任何业务/平台/聚合模块")
    void ar2_commonMustBeDependencyFree() {
        noClasses().that().resideInAPackage(ROOT + ".common..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        ROOT + ".business..",
                        ROOT + ".platform..",
                        ROOT + ".aggregate..",
                        ROOT + ".app..")
                .because("common 是公共基础设施，不含任何业务逻辑")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // AR-3 聚合模块只读
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-3：聚合模块只读，@Transactional 必须 readOnly = true")
    void ar3_aggregateTransactionsMustBeReadOnly() {
        methods().that().areDeclaredInClassesThat().resideInAPackage(ROOT + ".aggregate..")
                .and().areAnnotatedWith(Transactional.class)
                .should(beReadOnlyTransactional())
                .because("AR-3：metrics／warning／worklist 的查询不得持有事务写权限，"
                        + "保证指标计算不会意外修改业务数据")
                // 三个聚合模块到阶段 3 才有类
                .allowEmptyShould(true)
                .check(classesUnderTest);
    }

    @Test
    @DisplayName("AR-3：聚合模块不得出现写方法命名")
    void ar3_aggregateMustNotDeclareWriteMethods() {
        noMethods().that().areDeclaredInClassesThat().resideInAPackage(ROOT + ".aggregate..")
                .should().haveNameMatching("(save|insert|update|delete|remove|create)[A-Z].*")
                .because("AR-3：聚合模块只读。任务派生等写操作由 worklist 的事件监听在业务侧完成，"
                        + "不是聚合查询的职责")
                // 同上，阶段 3 删
                .allowEmptyShould(true)
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // AR-4 跨业务模块的编排放在 app 的应用服务
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-4：业务与平台模块不得反向依赖 app，编排只能自上向下")
    void ar4_orchestrationOnlyFlowsDownward() {
        noClasses().that().resideInAnyPackage(
                        ROOT + ".business..",
                        ROOT + ".platform..",
                        ROOT + ".aggregate..")
                .should().dependOnClassesThat().resideInAPackage(ROOT + ".app..")
                .because("AR-4：跨模块编排放在 app 的应用服务，模块自身不感知编排层的存在")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // AR-5 原生 SQL 只允许出现在 repository 包与 mapper XML
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-5：MyBatis Mapper 只能位于 repository 包内")
    void ar5_mappersMustResideInRepositoryPackages() {
        classes().that().areAnnotatedWith(org.apache.ibatis.annotations.Mapper.class)
                .should().resideInAPackage("..repository..")
                .because("AR-5：让 54 个指标 SQL 集中在一处，便于逐条对照需求文档第 15 章验收")
                .check(classesUnderTest);
    }

    @Test
    @DisplayName("AR-5：Service 与 Controller 不得直接使用 MyBatis／JdbcTemplate 等 SQL 执行设施")
    void ar5_noSqlOutsideRepository() {
        noClasses().that().resideInAnyPackage("..service..", "..controller..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.apache.ibatis..",
                        "org.springframework.jdbc.core..")
                .because("AR-5：原生 SQL 只允许出现在 repository 包与 mapper/*.xml 内")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // AR-6 领域事件一律 BEFORE_COMMIT
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-6：不得出现 AFTER_COMMIT 的事件监听器")
    void ar6_noAfterCommitListeners() {
        methods().that().areAnnotatedWith(TransactionalEventListener.class)
                .should(useBeforeCommitPhase())
                .because("AR-6：一期全部联动都要求强一致（写流转日志、派生任务、写催办台账）。"
                        + "出现 AFTER_COMMIT 说明有人凭惯性引入了本项目不需要的异步处理")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // AR-7 权限判定只允许出现在一处
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("AR-7：账号类型只允许在 app.security 包内被引用")
    void ar7_permissionDecisionOnlyInInterceptor() {
        noClasses().that().resideOutsideOfPackages(
                        ROOT + ".app.security..",
                        ROOT + ".common.security..",
                        // 断言自身要引用 AccountType 才能表达这条规则
                        ROOT + ".architecture..")
                .should().dependOnClassesThat().haveFullyQualifiedName(AccountType.class.getName())
                .because("AR-7／PMI-4：共享两账号下判权是无状态的，唯一判权位置是 PermissionInterceptor。"
                        + "业务代码里出现账号类型比较，或读 owner_id 判权，都是违规——"
                        + "它能编译、能通过大部分测试，只有真实使用时才暴露成"
                        + "「运营改不了别人负责的课程」")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // E1-5 全部写接口有权限注解
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("出口准则 E1-5：每个写接口（POST/PUT/PATCH/DELETE）都必须声明 @WriteApi")
    void e1_5_everyWriteEndpointDeclaresAudience() {
        methods().that().areDeclaredInClassesThat().resideInAPackage("..controller..")
                .and(areWriteMappings())
                .should().beAnnotatedWith(WriteApi.class)
                .because("出口准则 E1-5 与纪律 PMI-1：写接口默认拒绝，开放范围必须在接口上写明。"
                        + "漏注解的接口在运行时会被 PermissionInterceptor 直接拒绝，"
                        + "补注解时请顺便确认需求 6.2 的权限矩阵里有对应一行")
                .check(classesUnderTest);
    }

    @Test
    @DisplayName("E1-5 配套：USER_ALLOWED 只允许出现在案例模块——白名单就是需求 6.2.5 的那两条")
    void e1_5_userWritableWhitelistStaysAtTwo() {
        methods().that().areAnnotatedWith(WriteApi.class)
                .and(haveAudience(WriteAudience.USER_ALLOWED))
                .should().beDeclaredInClassesThat().resideInAPackage(ROOT + ".business.kase..")
                .because("需求 6.2.5：用户账号唯一可写的是案例点赞与案例评论。"
                        + "在别处出现这一档，等于绕过权限矩阵给只读账号开了写口子")
                // 案例模块到阶段 2 才有 Controller
                .allowEmptyShould(true)
                .check(classesUnderTest);
    }

    @Test
    @DisplayName("E1-5 配套：ANONYMOUS 只允许出现在登录接口所在的类")
    void e1_5_anonymousWritesOnlyForLogin() {
        methods().that().areAnnotatedWith(WriteApi.class)
                .and(haveAudience(WriteAudience.ANONYMOUS))
                .should().beDeclaredInClassesThat().haveSimpleName("AuthController")
                .because("未登录可写的只有登录与登出。多出一条就意味着有写接口对匿名请求开放，"
                        + "而一期的访问控制点只有登录态（规则 F3、SEC1）")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // 一期不做的 18 项：把最容易被"顺手引入"的组件写成断言
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("不做项：不得引入 Redis、MinIO、消息队列、Elasticsearch、ShedLock 等组件")
    void forbiddenInfrastructureMustNotAppear() {
        noClasses().that().resideInAPackage(ROOT + "..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework.data.redis..",
                        "redis.clients..",
                        "io.lettuce..",
                        "io.minio..",
                        "org.apache.kafka..",
                        "com.rabbitmq..",
                        "org.springframework.amqp..",
                        "org.elasticsearch..",
                        "co.elastic.clients..",
                        "net.javacrumbs.shedlock..",
                        "org.springframework.session..",
                        "com.alibaba.nacos..")
                .because("《开发实施文档》1.6 一期不做项第 16～18 条：单实例部署、数据量小，"
                        + "Redis 的五个用途已逐条消失；会话用 JVM 内存 HttpSession")
                .check(classesUnderTest);
    }

    @Test
    @DisplayName("不做项：不得引入工作流／规则引擎")
    void forbiddenWorkflowEnginesMustNotAppear() {
        noClasses().that().resideInAPackage(ROOT + "..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.flowable..",
                        "org.activiti..",
                        "org.camunda..",
                        "org.drools..")
                .because("需求文档 16.2 第 11 项：没有审批引擎、没有工作流引擎。"
                        + "状态机用代码内的转换表实现（TD-1）")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // 分层命名约定：让后续会话生成的代码落在正确的包里
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("分层：Controller 只能位于 controller 包内")
    void controllersMustResideInControllerPackages() {
        classes().that().areAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
                .should().resideInAPackage("..controller..")
                .check(classesUnderTest);
    }

    // -------------------------------------------------------------------------
    // 自定义条件
    // -------------------------------------------------------------------------

    /**
     * 写映射 = 带 POST／PUT／PATCH／DELETE 的方法。
     *
     * <p>按注解识别而不是按方法名：{@code delete(...)} 可能是个读接口，
     * 而 {@code confirm(...)} 是个写接口，名字说明不了 HTTP 语义。
     */
    private static DescribedPredicate<JavaMethod> areWriteMappings() {
        return new DescribedPredicate<>("are annotated with a write @RequestMapping") {
            @Override
            public boolean test(JavaMethod method) {
                return WRITE_MAPPINGS.stream().anyMatch(method::isAnnotatedWith);
            }
        };
    }

    private static DescribedPredicate<JavaMethod> haveAudience(WriteAudience audience) {
        return new DescribedPredicate<>("declare audience " + audience) {
            @Override
            public boolean test(JavaMethod method) {
                return method.getAnnotationOfType(WriteApi.class).value() == audience;
            }
        };
    }

    private static ArchCondition<JavaMethod> beReadOnlyTransactional() {
        return new ArchCondition<>("be annotated with @Transactional(readOnly = true)") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                Transactional annotation = method.getAnnotationOfType(Transactional.class);
                boolean readOnly = annotation.readOnly();
                events.add(new SimpleConditionEvent(method, readOnly,
                        String.format("%s 的 @Transactional 未声明 readOnly = true（%s）",
                                method.getFullName(), method.getSourceCodeLocation())));
            }
        };
    }

    private static ArchCondition<JavaMethod> useBeforeCommitPhase() {
        return new ArchCondition<>("use TransactionPhase.BEFORE_COMMIT") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                TransactionalEventListener annotation =
                        method.getAnnotationOfType(TransactionalEventListener.class);
                boolean beforeCommit = annotation.phase() == TransactionPhase.BEFORE_COMMIT;
                events.add(new SimpleConditionEvent(method, beforeCommit,
                        String.format("%s 使用了 %s，应改为 BEFORE_COMMIT（%s）",
                                method.getFullName(), annotation.phase(),
                                method.getSourceCodeLocation())));
            }
        };
    }
}
