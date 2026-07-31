# CLAUDE.md · 项目宪法

> 本文件是 AI 编码助手每次会话的**常驻上下文**。它由《AI学院联合作战平台开发实施文档 V1.3》8.3.1 规定的七块内容组成。
>
> **优先级**：本文件 > 各阶段提示词 > AI 的既有经验。凡本文件与你的训练经验冲突，一律以本文件为准。
>
> 权威文档（本文件只做摘要，细节一律回查原文）：
> - `需求文档/AI学院联合作战平台需求文档.md` **V1.3**
> - `需求文档/AI学院联合作战平台设计基础规范.md` **V1.1**（其编制依据仍写需求 V1.2；需求 V1.3 只改文档内部不一致，未触及设计相关内容）
> - `开发文档/AI学院联合作战平台开发实施文档.md` **V1.3**
> - `开发文档/阶段实施/阶段N-*.md` —— 六个阶段各一份，含该阶段的提示词、出口准则与验收动作
> - `需求文档/课程自检CheckList初版.md`、`设计文档/01-体验总纲.md`

---

## 一、项目定位与一期范围边界

### 一句话定位

> **AI学院运营记录与可视化平台。** 平台记录线下已经发生的事，不替线下做判断。

### 三条设计原则（体验总纲 P1、需求文档 2.2）

| # | 原则 | 对编码的含义 |
|---|---|---|
| 原则一 | 决策在线下，平台只记录结果 | 不实现审批引擎、评审规则引擎、条件判定逻辑。所有结论由运营人工录入 |
| 原则二 | 状态手动流转，但变更必须自动留痕 | 无自动状态跳转、无流转前置校验；但每次状态变更必须写状态流转日志 |
| 原则三 | 一期只做数据底座与展示，不做评估模型 | 能力地图、组织覆盖分级、案例价值评估均为二期 |

### 一期范围（24 个一级页面）

| 分组 | 页面 |
|---|---|
| 总看板 | 首页驾驶舱 |
| 驾驶舱一 · AI需求图（3） | P1-1 需求列表 / P1-2 需求详情 / P1-3 需求态势图 |
| 驾驶舱二 · 课程工作台（4） | P2-1 课程列表 / P2-2 课程详情 / P2-3 课程状态地图 / P2-4 课程排期日历 |
| 驾驶舱三 · 讲师图（3） | P3-1 讲师池列表 / P3-2 讲师详情 / P3-3 试讲台账 |
| 驾驶舱四 · 培训运营图（4） | P4-1 培训排期日历 / P4-2 培训计划列表 / P4-3 培训计划详情 / P4-4 培训场次详情 |
| 驾驶舱五 · 案例图（4） | P5-1 案例数据看板 / P5-2 案例列表 / P5-3 案例详情 / P5-4 总结报告 |
| 三中心（3） | 任务中心 / 催办记录台账 / 评审记录中心 |
| 导入中心（1） | 6 类导入 |
| 配置中心（1） | 4 个 Tab |

规模：**15 个状态机**、**54 个指标**、**6 类导入**、**43 张表**、**使用者 100 人以内**、**2 个共享账号**。

### 六个阶段（顺序不可打乱，DEP-1/2/3'）

| 阶段 | 内容 | 页面 |
|---|---|---|
| 0 | 工程骨架与决策关闭 | 0 |
| 1 | 平台底座与数据入口（状态机、双日志、权限、6 类导入、附件、并发） | 3 |
| 2 | 五驾驶舱业务主线 | 18 |
| 3 | 指标、总看板、三色灯、任务中心 | 2 |
| 4 | 催办台账、评审记录中心、导出 | 1 |
| 5 | 硬化、UAT 与上线 | 0 |

**不要提前实现后续阶段的内容。** 每个阶段有二值的出口准则（E0～E5），"顺手做了"会拉长验收周期。

---

## 二、技术栈与版本（开发实施文档 3.6）

| 分类 | 选型 | 版本 | 纪律 |
|---|---|---|---|
| 后端语言 | Java | **17 LTS** | 标准 OpenJDK，无信创要求 |
| 后端框架 | Spring Boot | **3.2.x** | — |
| 持久层 | MyBatis-Plus + 手写 SQL | 3.5.x | 单表 CRUD 用 MP；复杂查询回落 Mapper XML |
| 数据库 | PostgreSQL | **15+** | **刻意使用专有语法**（`FILTER`、`DISTINCT ON`、`JSONB`、部分索引），不做数据库隔离 |
| 迁移 | Flyway | 10.x | 见第六节 DB-1～DB-5 |
| Excel | Alibaba EasyExcel | 3.3.x | **必须流式读写**，禁止 POI 全量 DOM |
| 校验 | Jakarta Validation | — | 字段级用注解，跨字段用自定义校验器 |
| API 文档 | springdoc-openapi | 2.x | 生成 OpenAPI 3 |
| 定时任务 | Spring Scheduling | — | 单实例，**不引 ShedLock** |
| 文件存储 | 本地磁盘 + `FileStorage` 接口 | — | **全项目唯一保留接口隔离的地方**（STK-2） |
| 后端测试 | JUnit 5 + Testcontainers + MockMvc | — | **禁止用 H2 测指标 SQL**，必须真实 PostgreSQL |
| 架构约束 | ArchUnit | 1.x | AR-1～AR-7 作为 CI 门禁 |
| 前端框架 | React + TypeScript | 18 / 5.x | — |
| 构建 | Vite | 5.x | — |
| 组件库 | **Ant Design 5** | 5.x | **不允许引入 AntD 之外的 UI 库** |
| 状态管理 | TanStack Query + Zustand | 5.x / 4.x | **不用 Redux** |
| 路由 | React Router | 6.x | — |
| 表单 | AntD Form + Zod | — | — |
| 图表 | **ECharts 5** | 5.x | 唯一图表库，按需引入 |
| 富文本 | wangEditor 5 | 5.x | 仅案例正文使用 |
| 前端测试 | Vitest + Testing Library + Playwright | — | — |
| 反向代理 | Nginx | — | 配合 200MB 分片上传设置 `client_max_body_size` |
| 容器 | Docker Compose 单文件 | — | **三个容器：app + postgres + nginx** |

**同一件事只允许一个库。** 例如工具类统一用一个（不要一处 Hutool、一处 Apache Commons）；日期时间统一 `java.time`。新增任何依赖前先检查本表。

**STK-1（强要求）**：前端**禁止手写状态值与枚举字符串字面量**。全部状态枚举与字段枚举由后端 OpenAPI 生成或 `/api/meta/enums` 下发。理由：设计稿曾出现 8 处状态机里不存在的状态值（如试讲「条件通过」、评审「待定」、需求「待澄清」），AI 会更频繁地犯同类错误。

---

## 三、命名对照表（开发实施文档 7.6）

需求文档全中文，代码全英文。**这是唯一权威的对照表，禁止自行发明同义词。**

| 中文 | 英文 | 说明 |
|---|---|---|
| AI需求 | `demand` | **不用 `requirement`** |
| 课程 | `course` | — |
| 讲师 | `lecturer` | **不用 `teacher` / `trainer` / `instructor`** |
| 培训计划 | `trainingPlan` | — |
| 培训场次 | `trainingSession` | **不用 `class` / `batch`** |
| 案例 | `kase`（Java 包名）/ `caseInfo`（DTO）/ `biz_case`（表名） | `case` 是 Java 与 SQL 保留字 |
| 评审 | `review` | **不用 `approval`**（一期无审批引擎） |
| 试讲 | `trial` | 不用 `rehearsal` |
| 自检 | `selfCheck` | — |
| 签到 | `attendance` | — |
| 负责人 | `owner` | 不用 `manager` / `responsible` |
| 运营账号 | `operator` | 账号类型之一 |
| 用户账号 | `viewer` | **不用 `user`**（太泛，会与"使用者"混淆） |
| 业务验收 | `acceptance` | 不用 `approval` |
| 课程有效期 | `validity` | 字段 `validFrom` / `validTo` |
| 培养状态 | `cultivationStatus` | 讲师字段 |
| 催办台账 | `escalation` | **不用 `message` / `notification` / `urge`**——系统不发消息 |
| 浏览次数 | `viewCount` | 不用 `readCount` |
| 三色灯 / 预警灯 | `warningLight` | 灯色值 `BLUE` / `YELLOW` / `RED` / `NONE` |
| 状态停滞 | `stalled` | — |
| 分流出口 | `outlet` | — |
| 导入批次 | `importBatch` | — |
| ~~代理人~~ | ~~`delegate`~~ | **已删除**（N19） |

### 表名前缀（6.1.1）

| 前缀 | 含义 | 示例 |
|---|---|---|
| `biz_` | 核心业务对象 | `biz_demand`、`biz_course`、`biz_case` |
| `rel_` | N:N 关联表 | `rel_demand_course` |
| `dtl_` | 从表明细 | `dtl_course_review`、`dtl_attendance` |
| `org_` | 人员台账 | `org_employee`（**不再有 `org_department`**） |
| `audit_` | 日志类 | `audit_state_log`、`audit_op_log` |
| `cfg_` | 配置类 | `cfg_warning_threshold` |
| `dict_` | 字典 | `dict_item` |
| `sys_` | 系统与平台 | `sys_attachment`、`sys_task` |

### 全表公共字段（6.1.2）—— 一个字段都不能省

```sql
id              BIGSERIAL PRIMARY KEY,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by      VARCHAR(50) NOT NULL,                 -- 共享账号号，固定两值之一
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- 需求 C6「最后编辑时间」
updated_by      VARCHAR(50),
deleted         BOOLEAN     NOT NULL DEFAULT FALSE    -- SEC2 一律逻辑删除

-- 五类带状态的主对象额外包含：
last_state_changed_at TIMESTAMPTZ,           -- 需求 C5，红灯判定唯一依据
version               INT NOT NULL DEFAULT 0 -- K1，仅需求/课程/案例三张表
```

> **`updated_at` 与 `last_state_changed_at` 必须是两个独立字段。** 改一个错别字只更新 `updated_at`，红灯不会消失。**这两个字段是全库最容易被"优化"成一个的地方，一旦合并，停滞预警与 9 个效率指标整体失效。**
>
> **`version` 只加在需求、课程、案例三张表上**，不要给第四张表加。

### 其他建模约定

| 项 | 约定 |
|---|---|
| 枚举存储 | **中文字符串**（`'评审决策'`），`VARCHAR(64)` + CHECK 或应用层校验。**不用数字码、不用 PG ENUM 类型** |
| 时间类型 | 统一 `TIMESTAMPTZ`；**纯日期语义的字段用 `DATE`**（预计完成时间、计划结束日期、授课日期） |
| 逻辑删除 | 全系统 `deleted` 逻辑删除，查询一律带 `WHERE deleted = false`，配部分索引 |

> **纯日期字段用 `DATE` 不是风格问题。** 三色灯与效率指标按自然日计算，存成带时分秒的时间戳会让"剩余天数"出现 ±1 天偏差，这是真实且高频的 Bug 来源。

---

## 四、架构分层与依赖规则

### 模块划分（4.2.1，15 个业务/平台模块 + 2 个工程模块）

| 层 | 模块 | 职责 |
|---|---|---|
| 工程 | `common` | 统一响应、错误码、异常、traceId、公共基类。**不含任何业务逻辑** |
| 工程 | `app` | Spring Boot 启动类、Web 层（Controller/DTO）、权限拦截器、**跨模块编排的应用服务（AR-4）** |
| 平台 | `platform/people` | 人员台账（讲师与学员）。**不是 IAM，没有账号与角色** |
| 平台 | `platform/statemachine` | 15 个状态机的定义与转换执行引擎 |
| 平台 | `platform/audit` | 状态流转日志、操作审计日志 |
| 平台 | `platform/dataimport` | 6 类导入的通用框架 |
| 平台 | `platform/storage` | 附件上传（含分片）、下载鉴权、逻辑删除 |
| 平台 | `platform/escalation` | **催办台账**：记录催办对象、内容、时间。**不发送任何消息** |
| 平台 | `platform/dict` | 字典、三色灯阈值、自检 CheckList 配置 |
| 业务 | `business/demand` | AI需求、两条分流出口、业务验收、需求↔课程关联 |
| 业务 | `business/course` | 课程、有效期、材料版本、评审记录、试讲记录、试讲反馈、自检、排期 |
| 业务 | `business/lecturer` | 讲师、入池、培养状态、授课记录、学员评价 |
| 业务 | `business/training` | 培训计划、场次、排课校验、参训名单、签到、归档、学员反馈 |
| 业务 | `business/kase` | 案例、审核、互动数据、总结报告 |
| 聚合 | `aggregate/metrics` | 54 个指标公式、总看板数据装配 |
| 聚合 | `aggregate/warning` | 三色灯实时计算、变化检测、预警明细、有效期到期提示 |
| 聚合 | `aggregate/worklist` | 任务派生、任务中心、待办清单重算 |

**包名根**：`com.aiacademy.<层>.<模块>`，例如 `com.aiacademy.platform.statemachine`、`com.aiacademy.business.course`。

**模块内四层**：`controller` / `service` / `repository` / `domain`。Controller 只在 `app` 模块与各模块的 `controller` 包内。

### 依赖规则（AR-1～AR-7，全部由 ArchUnit 在 CI 中强制）

| # | 规则 |
|---|---|
| **AR-1** | **业务模块之间禁止直接依赖。** `demand` 不得 import `course` 的类，反之亦然。跨模块关系走应用服务或领域事件 |
| **AR-2** | **平台模块不得依赖业务模块与聚合模块。** 依赖方向永远是 业务/聚合 → 平台 |
| **AR-3** | **聚合模块只读。** `metrics`／`warning`／`worklist` 的查询代码不得调用写方法，`@Transactional` 必须 `readOnly = true` |
| **AR-4** | **跨业务模块的编排放在 `app` 模块的应用服务**，不放在任一业务模块内部 |
| **AR-5** | **原生 SQL 只允许出现在 `**/repository/**` 与 `**/mapper/*.xml`**，不得出现在 Service 或 Controller。目的是让 54 个指标 SQL 集中一处便于逐条对账 |
| **AR-6** | 同事务内的领域事件用 `@TransactionalEventListener(phase = BEFORE_COMMIT)`。**当前实现中不应出现任何 `AFTER_COMMIT` 监听器** |
| **AR-7** | **权限判定只允许出现在 `PermissionInterceptor` 一处。** 业务代码内不得有任何账号类型比较，不得读 `owner_id` 做判权 |

### 跨模块协作用领域事件（4.2.3）

| 事件 | 发布方 | 订阅方 | 动作 |
|---|---|---|---|
| `StateChangedEvent` | `statemachine` | `audit` | 写状态流转日志 |
| `StateChangedEvent` | `statemachine` | `worklist` | 按 13.1.2 派生任务 |
| `StateChangedEvent`（课程首次进入「发布」） | `statemachine` | `course` | 写首次发布时间并按有效期算截止日（EX1） |
| `LightColorChangedEvent` | `warning` | `worklist` | 把变色对象**追加进待办清单**（不发通知） |
| `ImportCommittedEvent` | `dataimport` | `lecturer`/`training`/`course` | 导入后的自动动作 |
| `CourseQualifiedEvent` | `course` | `kase` | 课程达精品后创建案例，初始状态「整理中」 |

---

## 五、一期明确不做的 18 项（1.6）

**做了就是超范围。这是最高频的越界来源，每条都是"AI 很可能主动做、做了就是白做"的东西。**

| # | 不做项 |
|---|---|
| 1 | 企业 SSO、HR 组织架构自动同步 |
| 2 | 移动端专属页面 |
| 3 | 直播／视频系统集成、日历集成 |
| 4 | **站内信、公众号、WeLink、邮件——全部消息渠道** |
| 5 | **消息发送状态、重试、回执** |
| 6 | 数据仓库、复杂趋势分析、搜索引擎 |
| 7 | 敏感信息按组织隔离（**永久不做**） |
| 8 | 深色模式、多语言、主题定制 |
| 9 | 导出文件水印 |
| 10 | 附件病毒扫描 |
| 11 | **RBAC、角色表、权限表、菜单权限表、用户管理页面** |
| 12 | **组织架构表、部门树、部门维度统计**（N18） |
| 13 | **代理机制、代理有效期判断**（N19） |
| 14 | **热力图、地图类可视化**（唯一场景已推二期） |
| 15 | **收藏功能**（N21，无个人身份） |
| 16 | **双实例、滚动发版、负载均衡、K8s** |
| 17 | **物化视图、预聚合表、定时聚合任务** |
| 18 | **Redis 与任何缓存层**（会话用 JVM 内存 `HttpSession`，也不引 Spring Session） |

### 连带的禁止清单

不要创建这些表：`org_department`、`sys_user`、`sys_role`、`sys_permission`、`sys_menu`、`sys_object_delegate`、`sys_message`、`dtl_case_favorite`。

不要引入这些组件：Redis、MinIO、Kafka/RabbitMQ、Elasticsearch、ShedLock、Nacos、Flowable/Activiti/Camunda、任何 APM、任何工作流引擎、任何规则引擎。

不要定义空的 `MessageChannel` / `Notifier` 接口——**留一个空接口是有害的**，它会让读代码的人以为"有消息能力只是没配"。

---

## 六、接口、响应、错误码与时间格式

### 接口总则（7.1）

| # | 规则 |
|---|---|
| API-1 | 全部接口 `/api` 前缀，RESTful，资源名用**复数英文小写连字符** |
| API-2 | **接口先定义、后实现**，OpenAPI 契约先行 |
| API-3 | 统一响应包装，见下 |
| API-4 | 时间一律 ISO-8601 带时区（`2026-07-29T14:30:00+08:00`）；纯日期字段 `2026-07-29` |
| API-5 | 金额与比率用**字符串**传输；「—」用 `null` 表达 |
| API-6 | 分页统一 `pageNum`（从 1 开始）/ `pageSize`（默认 20，上限 200） |

### 统一响应格式（7.2）

```json
{ "code": "OK", "message": null, "data": {}, "traceId": "a1b2c3d4" }
```

```json
{
  "code": "ILLEGAL_TRANSITION",
  "message": "当前状态为「立项」，不能执行「提交评审」",
  "data": { "currentState": "立项", "action": "提交评审" },
  "traceId": "a1b2c3d4"
}
```

> **`message` 必须是可直接展示给用户的中文**，不是异常堆栈、不是英文技术描述。这是体验总纲 C-1「界面必须能解释为什么不能操作」的接口侧要求。`data` 里带结构化上下文供前端做精细提示。`traceId` 全链路透传并写入日志。

### 错误码（7.3）—— 一期只有这 12 个，不要新增

| code | HTTP | 语义 | 前端处理 |
|---|---|---|---|
| `OK` | 200 | 成功 | — |
| `PARAM_INVALID` | 400 | 参数校验失败 | 表单字段级错误提示 |
| `UNAUTHENTICATED` | 401 | 未登录或会话过期 | 跳登录页 |
| `FORBIDDEN` | 403 | 无权限 | 展示 `message` 中的具体原因 |
| `NOT_FOUND` | 404 | 对象不存在或已删除 | 空状态页 |
| `ILLEGAL_TRANSITION` | 409 | 状态机非法转换（C3） | 弹窗提示 + 引导刷新 |
| `CONCURRENT_MODIFIED` | 409 | 乐观锁冲突（K1） | 固定文案「该记录已被他人修改，请刷新后重试」 |
| `DUPLICATE_SUBMIT` | 409 | 幂等键命中（K2/K3） | **静默忽略，表现为操作成功** |
| `URGE_TOO_FREQUENT` | 409 | 催办防重复窗口（48 小时） | 二次确认弹窗，带 `force` 重试 |
| `IMPORT_VALIDATION_FAILED` | 422 | 导入校验失败 | 展示错误报告并提供下载 |
| `BIZ_RULE_VIOLATED` | 422 | 其他业务规则不满足 | 展示 `message` |
| `INTERNAL_ERROR` | 500 | 系统异常 | 通用错误页 + `traceId` |

### 状态转换接口的统一形态（7.4）

**不要为每个动作单独开接口。** 15 个状态机、上百个转换共用两个接口：

```
POST /api/{objectType}/{id}/transitions
{ "stateField": "main_state", "action": "SUBMIT_REVIEW", "remark": "...", "version": 7, "payload": {} }

GET  /api/{objectType}/{id}/transitions/available
→ [ { "action": "SUBMIT_REVIEW", "label": "提交评审", "enabled": true },
    { "action": "CLOSE", "label": "关闭课程开发", "enabled": false,
      "disabledReason": "当前状态为「已发布」，不允许再提交评审" } ]
```

### 枚举与字典下发（7.5）

```
GET /api/meta/enums       GET /api/meta/dicts       GET /api/meta/thresholds
```

启动后缓存（**进程内缓存，不是 Redis**），前端登录后拉一次。配置中心保存时清缓存。

### 数据库变更管理（6.5）

| # | 规则 |
|---|---|
| DB-1 | 全部 DDL 走 Flyway，**禁止在任何环境手工执行 DDL** |
| DB-2 | 命名 `V{阶段}_{序号}__{描述}.sql`，如 `V1_003__create_course_tables.sql` |
| DB-3 | **已合并到主干的脚本禁止修改**，修正必须新增脚本 |
| DB-4 | 初始化数据（字典、阈值、派生规则）用 `R__` 可重复执行脚本 |
| DB-5 | 每阶段结束导出一份完整 schema 快照存档 |

---

## 七、权限模型：全平台只有两个共享账号

> **这是 AI 最容易自动"补全"错的一节。** 你的训练数据里"权限系统"几乎都是 RBAC。**本项目不是。**

### 判定式（需求文档 6.2 规则 PM1）

> **允许写入 = 当前账号类型 == 运营账号**
>
> 唯一的两个例外：**点赞、评论**两个接口对用户账号也开放（6.2.5）

**这个判定式是无状态的**：不加载对象、不查库、不关心当前状态、不关心负责人。全项目唯一的判权位置：

```java
@Component
public class PermissionInterceptor implements HandlerInterceptor {

    private static final Set<String> USER_WRITABLE = Set.of(
        "POST /api/cases/{id}/likes",
        "POST /api/cases/{id}/comments"
    );

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if (isReadOnlyMethod(req.getMethod())) return true;           // GET/HEAD 全部放行
        if (currentAccount().isOperator())      return true;           // 运营账号：全部放行
        if (USER_WRITABLE.contains(routePattern(req))) return true;    // 两个例外
        throw new ForbiddenException("ONLY_OPERATOR_CAN_WRITE");       // 其余一律拒绝
    }
}
```

### 实现纪律（PMI-1～PMI-5）

| # | 规则 |
|---|---|
| PMI-1 | 全部写接口（POST/PUT/PATCH/DELETE）**默认拒绝**，白名单只有点赞与评论两条。不允许在 Controller 上单独关闭拦截 |
| PMI-2 | **读接口无任何数据级过滤。** 一期读权限完全无差异（操作审计日志对用户账号也开放） |
| PMI-3 | **附件下载必须鉴权**，不得生成永久公开链接；用带签名与有效期的临时 URL。这条不因权限简化而放松 |
| PMI-4 | **业务代码内不得出现任何判权逻辑**：不读 `owner_id` 判断、不比较账号类型、不在 Service 层调权限服务 |
| PMI-5 | **前端不得依赖"字段是否为空"推断权限。** 用户账号下写操作入口整体不渲染，依据是登录时拿到的账号类型 |

### 三条必须记住的后果

| 影响 | 处理 |
|---|---|
| 审计日志无法追溯到个人 | 已被业务接受（AC1）。日志表仍保留 `operator_no`、`operator_name` 两列并写固定值，二期开号后直接生效 |
| **乐观锁冲突从偶发变成常态** | 2–4 名运营用同一账号并行录入。乐观锁必须在阶段 1 落地，冲突提示要带最后修改时间 |
| 幂等键不能用「用户 ID + 业务键」 | 用户 ID 是常量，起不到区分作用。**改用「对象ID + 版本号 + 目标状态」** |

### `ActionGuard` 是状态门，不是权限门（4.3.2）

前端不做本地权限推断，只按后端返回的 `allowedActions` / `blockedActions` 渲染：

```typescript
interface ActionAvailability {
  allowedActions: string[];
  blockedActions: Array<{ action: string; reason: string }>;
}
```

`reason` 说的是**状态原因**（「当前状态为「已发布」，不允许再提交评审」），不是「你没有权限」。

---

## 八、最容易被"好心纠正"的 8 条业务事实

这些规则读起来会让人觉得不合理，**但它们都是业务已确认的决策。不得自行"修正"。**

| # | 事实 | 依据 | 会被怎么改错 |
|---|---|---|---|
| 1 | **`owner_id` 保留但不参与判权** | 事实 9、PMI-4 | 看到表上有 `owner_id`，几乎必然生成"只有负责人能改"。**它能编译、能过大部分测试**（测试数据里运营恰好是负责人），只有真实使用时才暴露成"运营改不了别人负责的课程" |
| 2 | **状态变更不做业务前置条件校验**（只校验状态机合法性） | C2 | 会加上"课程未自检不能提交评审"。**加了就会拦住运营录入历史数据** |
| 3 | **非法状态转换必须硬阻断在服务层** | C3 | 会只在前端隐藏按钮 |
| 4 | **状态一律手动变更，系统不做任何自动流转** | C1 | 会加定时任务自动推进状态 |
| 5 | **效率指标取「首次」到达目标状态的时间** | E1 | 会写 `MAX(变更时间)`。**必须是 `MIN`**——对象可反复回退，取最后一次会把周期无限拉长 |
| 6 | **讲师培养状态与课程过期标记不写状态流转日志** | TS2、EX | 会一并写进流转日志，污染效率统计。培养状态是自由选择的枚举；过期标记不落库、实时计算 |
| 7 | **系统不发任何消息，但仍要算出"该催谁"** | MSG1、RM1～RM5 | 会把清单生成一起删掉。**删了催办功能价值归零**——运营得自己去五个驾驶舱翻找谁逾期 |
| 8 | **实时计算指标，不建预聚合** | U2、C14 | 会"顺手"加物化视图或每小时聚合任务。2 万条签到下毫无压力，缓存反而让运营改完数据看到旧值 |

---

## 九、设计规范要点（前端必读）

### 核心 Token（设计基础规范 2.2、2.3、3.2、4.1、4.6）

| 用途 | 值 |
|---|---|
| **品牌识别色** `brand-500` | `#5B82FF`（Logo、插画、图表主序列、大号标题 ≥24px） |
| **交互主色** `brand-600` | `#4E70DB`（**主按钮底色**、正文尺寸链接。承载白字需 4.5:1） |
| 主按钮 hover / active | `brand-700` `#3E5AB0` / `brand-800` `#2E4385` |
| 页面背景 | `neutral-100` `#F5F7FA` |
| 卡片背景 | `neutral-0` `#FFFFFF` |
| 正文 | `neutral-700` `#4B5563` / 14px / 22 行高 |
| 表单控件边框 | `neutral-500` `#8A929E`（**不是 `neutral-200`**，WCAG 要求 3:1） |
| placeholder | `neutral-600` `#667085`（**不是 `neutral-400`**） |
| 空值占位 `—` | `neutral-400` `#ACB3BD` |
| 按钮/输入框圆角 | `radius-sm` **6px** |
| 卡片圆角 | `radius-lg` 12px |
| 间距基准 | 4px 标尺，**不允许 5px、7px、18px 这类非标值** |

### 三色灯（需求文档 13.4.1a，设计规范 2.5）

| 灯 | 语义 | 色值 | 浅底 | 图标 | 必现文案 |
|---|---|---|---|---|---|
| 蓝灯 | 即将到期 | `#0EA5E9` | `#E0F2FE` | 时钟 | 「即将到期 · 剩余 N 天」 |
| 黄灯 | 已逾期 | `#F59E0B` | `#FEF3C7` | 三角 | 「已逾期 · 逾期 N 天」 |
| 红灯 | 状态停滞 | `#EF4444` | `#FEE2E2` | 实心圆感叹号 | 「状态停滞 · 停滞 N 天」 |
| 无灯 | 健康 | `neutral-600` | — | 无图标 | — |

| # | 硬规则 |
|---|---|
| **VC2 / WV1** | **灯色不得作为唯一识别载体**，必须同时出现「图标 + 文字标签 + 天数」。任何位置出现无文字标签的纯色状态点，该处即不满足 WCAG AA |
| **WV2** | 四种状态的图标形状必须互不相同（黄与红在红绿色盲视野下极难区分） |
| **WV4** | **品牌蓝任何色阶不得出现在灯色、状态徽章、预警区**；反之四个语义色不得出现在插画与装饰图形中 |
| **蓝灯不是健康态** | 它是预警。健康态用中性色，预警区另设不可下钻的「健康对象数」 |

### 数字排版（3.3）

千分位 `1,268`；百分比保留 1 位小数且整数也保留 `100.0%`；周期均值保留 1 位小数 + 「天」（`平均 18.5 天`）；评分 `4.2 / 5`；天数整数 + 「天」；**零值显示 `0`，`—` 仅表示"无数据"**；日期 `YYYY-MM-DD`，含时间 `YYYY-MM-DD HH:mm`（**不显示秒**）；表格数字必须 `tabular-nums`。

### 页面框架（4.2、4.5）

顶栏 56px；侧栏展开 240px / 收起 64px；内容区内边距 24px；卡片内边距 24px。**基准 1440×900，`min-width: 1440px`，<1440px 不适配。** 一期不做侧栏自动收起、表格转卡片、图表降级。

### 四个必须先做的前端基础件（4.3.2）

`DataTable`（空值统一 `—`、三档密度、骨架屏列宽一致、吸顶偏移）、`WarningLight`（四态 × 三形态，强制图标+文案+天数）、`StatusTag`（课程有效期/培养状态/案例状态三组共 12 种取值）、`ActionGuard`（状态门）。

---

## 十、编码前的自检清单

每次开始写代码前，对照问自己：

1. 我要做的事在**当前阶段**的范围内吗？（第一节的阶段表）
2. 我要引入的库在**技术栈表**里吗？（第二节）
3. 我给的英文名与**命名对照表**一致吗？（第三节）
4. 我的 import 违反 **AR-1～AR-7** 吗？（第四节）
5. 我要做的事在**不做的 18 项**里吗？（第五节）
6. 我的响应格式与错误码在**那 12 个**里吗？（第六节）
7. 我是不是又写了 **RBAC 或 `owner_id` 判权**？（第七节）
8. 我是不是在"好心纠正"**第八节的 8 条事实**？

每个阶段结束时，**逐条自检出口准则并输出核对结果**（PT-3）。报告"已通过"时必须附上对应测试类名与实际运行输出，不要只复述结论。
