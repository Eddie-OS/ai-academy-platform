# E0-3：ArchUnit 违规拦截证据

出口准则 E0-3 要求「**用一个故意违规的提交验证会被拦下**」。只报告「断言已写好、CI 全绿」
是不够的——一条 `that()` 匹配不到任何类的断言会永远为真，看起来和真正生效的断言毫无区别。

本文件留存实际的拦截输出。验证方式：临时加入两个违规类，跑 `.\gradlew.bat :app:test`，
记录失败输出，然后删除违规类并确认恢复全绿。

## 一、临时加入的违规类

### 违规样本 1：业务模块自行判权 + Mapper 放错层

`backend/business/demand/src/main/java/com/aiacademy/business/demand/service/ViolationProbe.java`

```java
package com.aiacademy.business.demand.service;

import com.aiacademy.common.security.AccountType;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public class ViolationProbe {

    public boolean canEdit(AccountType accountType) {
        return accountType == AccountType.OPERATOR;
    }
}
```

这段代码**能编译、能通过全部单元测试**。它违反三条规则：账号类型比较出现在业务代码里（AR-7）、
`@Mapper` 不在 `repository` 包内（AR-5）、`service` 包依赖了 MyBatis（AR-5）。

### 违规样本 2：聚合模块出现写方法

`backend/aggregate/metrics/src/main/java/com/aiacademy/aggregate/metrics/service/AggregateWriteProbe.java`

```java
package com.aiacademy.aggregate.metrics.service;

public class AggregateWriteProbe {

    public void saveSnapshot() {
    }
}
```

违反 AR-3：聚合模块只读。

## 二、实际拦截输出

```
ArchitectureRulesTest > AR-3：聚合模块不得出现写方法命名 FAILED
    java.lang.AssertionError: Architecture Violation [Priority: MEDIUM] - Rule 'no methods that are
    declared in classes that reside in a package 'com.aiacademy.aggregate..' should have name matching
    '(save|insert|update|delete|remove|create)[A-Z].*', because AR-3：聚合模块只读。任务派生等写操作由
    worklist 的事件监听在业务侧完成，不是聚合查询的职责 was violated (1 times):
    Method <com.aiacademy.aggregate.metrics.service.AggregateWriteProbe.saveSnapshot()> has name
    matching '(save|insert|update|delete|remove|create)[A-Z].*' in (AggregateWriteProbe.java:7)

ArchitectureRulesTest > AR-5：Service 与 Controller 不得直接使用 MyBatis／JdbcTemplate 等 SQL 执行设施 FAILED
    java.lang.AssertionError: Architecture Violation [Priority: MEDIUM] - Rule 'no classes that reside
    in any package ['..service..', '..controller..'] should depend on classes that reside in any package
    ['org.apache.ibatis..', 'org.springframework.jdbc.core..'], because AR-5：原生 SQL 只允许出现在
    repository 包与 mapper/*.xml 内 was violated (1 times):
    Class <com.aiacademy.business.demand.service.ViolationProbe> is annotated with
    <org.apache.ibatis.annotations.Mapper> in (ViolationProbe.java:0)

ArchitectureRulesTest > AR-5：MyBatis Mapper 只能位于 repository 包内 FAILED
    java.lang.AssertionError: Architecture Violation [Priority: MEDIUM] - Rule 'classes that are
    annotated with @Mapper should reside in a package '..repository..', because AR-5：让 54 个指标 SQL
    集中在一处，便于逐条对照需求文档第 15 章验收 was violated (1 times):
    Class <com.aiacademy.business.demand.service.ViolationProbe> does not reside in a package
    '..repository..' in (ViolationProbe.java:0)

ArchitectureRulesTest > AR-7：账号类型只允许在 app.security 包内被引用 FAILED
    java.lang.AssertionError: Architecture Violation [Priority: MEDIUM] - Rule 'no classes that reside
    outside of packages ['com.aiacademy.app.security..', 'com.aiacademy.common.security..',
    'com.aiacademy.architecture..'] should depend on classes that have fully qualified name
    'com.aiacademy.common.security.AccountType', because AR-7／PMI-4：共享两账号下判权是无状态的，
    唯一判权位置是 PermissionInterceptor。业务代码里出现账号类型比较，或读 owner_id 判权，都是违规
    ——它能编译、能通过大部分测试，只有真实使用时才暴露成「运营改不了别人负责的课程」was violated (2 times):
    Method <com.aiacademy.business.demand.service.ViolationProbe.canEdit(com.aiacademy.common.security.AccountType)>
    gets field <com.aiacademy.common.security.AccountType.OPERATOR> in (ViolationProbe.java:11)
    Method <com.aiacademy.business.demand.service.ViolationProbe.canEdit(com.aiacademy.common.security.AccountType)>
    has parameter of type <com.aiacademy.common.security.AccountType> in (ViolationProbe.java:0)

13 tests completed, 4 failed
> Task :app:test FAILED
```

## 三、删除违规类后

```
BUILD SUCCESSFUL
13 tests completed, 0 failed
```

## 四、这次验证顺带确认的两件事

**其一，ArchUnit 确实扫到了 15 个领域模块的类，而不是只扫了 `app` 自己。**
`business.demand` 与 `aggregate.metrics` 的违规都被精确报出了文件名与行号。这一点必须验证：
15 个领域模块在 `app` 的测试运行时 classpath 上是 **jar** 而不是目录，
`ClassFileImporter` 若配了 `DoNotIncludeJars`，断言会全绿但什么都没检查。

**其二，`DoNotIncludeTests` 依赖构建目录的路径形状。**
它按 `build/classes/java/test` 识别测试类。本项目把构建输出重定向到了
`%USERPROFILE%\.ai-academy-build\`（原因见 README），末级目录仍保留 `build` 这个名字正是为此——
改名会让 ArchUnit 把断言自身当成生产代码扫进来，AR-7 立刻误报（断言本身要引用 `AccountType`）。

## 五、下一次会话需要注意

阶段 0 的 15 个领域模块只有 `package-info.java`，编译后不产生 class 文件，
因此 **AR-1／AR-2／AR-4 当前匹配到 0 个类**，靠
`app/src/test/resources/archunit.properties` 里的 `archRule.failOnEmptyShould=false` 才没报红。

**阶段 1 首个业务模块落地后，把该配置改回 `true`**，并重跑一次本文件的验证流程，
确认这三条断言真的在检查类。
