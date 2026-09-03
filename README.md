# AI学院联合作战平台

AI学院运营记录与可视化平台。**平台记录线下已经发生的事，不替线下做判断。**

一期规模：24 个一级页面、15 个状态机、54 个指标、6 类导入、43 张表、使用者 100 人以内、
**2 个共享账号**。当前进度：**阶段 0 工程骨架已完成**（见 [`docs/E0-自检报告.md`](docs/E0-自检报告.md)）。

编码前必读 [`CLAUDE.md`](CLAUDE.md)。

---

## 一、本地启动

开发机与生产机都是 **Windows 11 + WSL2 + Docker Desktop**（BLOCK-05），
因此运维脚本只提供 PowerShell 版本，仓库里没有 `.sh`。

### 工具链

| 工具 | 版本要求 | 说明 |
|---|---|---|
| **JDK** | **17** | **必须真实安装，不能靠 Gradle toolchain 自动下载**：Gradle 守护进程自身需要 JVM 17+ 才能加载 Spring Boot 插件，toolchain 只管编译。`winget install --source winget Microsoft.OpenJDK.17` |
| Node.js | 20 或更高 | — |
| **Docker Desktop** | 4.80 或更高 | 需含 `docker compose` v2 |
| Git | 2.x | — |

若 `JAVA_HOME` 仍指向旧版 JDK，在终端里先设置：

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
```

### 五条命令（出口准则 E0-2）

```powershell
# 1. 起数据库（本地只起 postgres，app 与前端直接跑，见开发实施文档 4.4.2）
docker compose -f docker-compose.local.yml up -d

# 2. 起后端。首次启动时 Flyway 自动建表（规则 DB-1：禁止手工执行 DDL）
cd backend; .\gradlew.bat :app:bootRun --args='--spring.profiles.active=local'

# 3. 造数（另开一个终端，在仓库根目录执行）
powershell -ExecutionPolicy Bypass -File scripts\seed\seed.ps1

# 4. 装前端依赖
cd frontend; npm install

# 5. 起前端
npm run dev
```

浏览器打开 http://localhost:5173 ，用下列账号登录：

| 账号 | 口令（仅本地） | 权限 |
|---|---|---|
| `operator` | `operator123` | 运营账号：全量写权限 |
| `viewer` | `viewer123` | 用户账号：只读，例外是点赞与评论 |

登录后应看到：顶栏三中心入口 + 侧栏五驾驶舱 + 总看板壳层，且总看板上的批次数据来自
`GET /api/imports`——它跑通说明「浏览器 → 后端 → PostgreSQL」整条链路正常。
（阶段 0 用的骨架示例接口已在 1C 随 `V1_009` 一并删除。）

> **用 `viewer` 登录时，侧栏不会出现「导入中心」「配置中心」。**
> 这是纪律 PMI-5 的体现：写操作入口整体不渲染，依据是登录时拿到的账号类型，与接口返回内容无关。

### 两个本机环境坑

**其一，构建输出不在 `backend/build` 下。** 仓库路径含中文（`F:\AI学院联合作战平台\...`），
Gradle 交给测试进程的 classpath 会按系统 ANSI 代码页编码，测试进程随即报
`ClassNotFoundException`（加 `-Dfile.encoding=UTF-8` 无效）。classpath 上只有 build 目录，
源码目录不在其上，因此根 `build.gradle.kts` 把构建输出整体重定向到
`%USERPROFILE%\.ai-academy-build\`。**测试报告与 jar 都在那里找。**
仓库若迁到纯英文路径，这段重定向会自动失效，回落到默认的 `build/`。

**其二，若终端里有失效的代理变量，npm 与 Docker 都会失败。**
症状是 `ECONNREFUSED 127.0.0.1:<端口>`。清掉后重试：

```powershell
Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY -ErrorAction SilentlyContinue
```

---

## 二、造数

造数脚本是**后续全部阶段的基础设施，不是可选项**（《阶段 0　工程骨架与决策关闭》范围表）。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\seed\seed.ps1
```

脚本先 `docker cp` 再 `psql -f`，而不是把 SQL 文本管道喂给 psql。这不是绕远路：
Windows PowerShell 5.1 向原生进程传管道文本时会按控制台代码页重新编码，
`在职` 会被替换成 `??` 并**真的以 `0x3F3F` 存进数据库**——这个坑在阶段 0 踩过一次，
`encode(convert_to(sample_state,'UTF8'),'hex')` 查出来是 `3f3f`。
凡是要把含中文的文件内容送进容器，都用 `docker cp`。

阶段 1 版本生成：

| 数据 | 数量 | 目标表 | 说明 |
|---|---|---|---|
| 人员台账 | 100 条 | `org_employee` | 工号 `E0001`～`E0100`，每 5 个里有 1 个离职 |
| 需求 | 1 条 | `biz_demand` | 刻意让 `updated_at` 是今天、`last_state_changed_at` 是 12 天前 |

那条需求的时间设置不是随手写的：它正是需求 L1 与 C6 要区分的场景——对象今天刚被
编辑过（改了个错别字），但状态已停滞 12 天，**红灯必须仍然亮着**。反向测试 E1-3
用的就是这种数据形态。离职人员的比例同理：全是在职的话，「离职负责人警告」（需求 14.3）
这类规则在本地开发时永远走不到。

造数脚本直接写表、不走导入接口，因此这些行没有 `import_batch_no`，撤销功能看不到它们。
要验导入就走导入接口。

---

## 三、跑测试

```powershell
# 后端：单元测试 + ArchUnit 架构门禁（AR-1～AR-7）
cd backend; .\gradlew.bat test

# 只跑架构门禁
cd backend; .\gradlew.bat :app:test --tests '*ArchitectureRulesTest'

# 前端：类型检查 + 构建 + Token 一致性测试（出口准则 E0-4）
cd frontend; npm run build; npm test -- --run

# 三者一次跑完 + 构建镜像
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
```

ArchUnit 是 **CI 门禁**，不是建议。它拦下的都是「能编译、能通过大部分测试、只有真实使用时
才暴露」的问题——最典型的是在业务代码里用 `owner_id` 判权。违规拦截的实际输出见
[`docs/E0-3-ArchUnit违规拦截证据.md`](docs/E0-3-ArchUnit违规拦截证据.md)。

> 阶段 0 的 15 个领域模块只有 `package-info.java`，编译后不产生 class 文件，
> 因此 AR-1／AR-2／AR-4 当前匹配到 0 个类。`app/src/test/resources/archunit.properties`
> 全局关闭了 ArchUnit 的「空 should 判失败」。**阶段 1 首个业务模块落地后要把它改回 `true`**，
> 否则这三条断言会长期处于「恒真」状态。

### 接口级冒烟测试

单元测试不覆盖登录、会话、CSRF、权限拦截这些只在真实 HTTP 请求下才成立的行为。
起好库与后端后执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

它按出口准则逐条发真实请求（两账号登录、401／403、响应体四字段、`traceId` 透传、
参数校验错误码），当前 13 项全通过。**每个阶段验收都跑它，新增出口准则时在脚本末尾追加断言，
不要另起脚本。**

也可以打生产栈（走 Nginx 的 80 端口，验证反向代理与 `traceId` 透传）：

```powershell
$env:SMOKE_BASE_URL='http://localhost'
$env:SMOKE_OPERATOR_PASSWORD='...'   # .env 里两个哈希对应的原文口令
$env:SMOKE_VIEWER_PASSWORD='...'
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## 四、目录结构

```
ai-academy-platform/
├─ CLAUDE.md                 项目宪法：AI 每次会话的常驻上下文（阶段 0 最重要的交付物）
├─ AGENTS.md                 指向 CLAUDE.md
├─ docker-compose.yml        生产：postgres + app + nginx 三个容器
├─ docker-compose.local.yml  本地：只起 postgres
├─ backend/
│  ├─ common/                统一响应 R<T>、12 个错误码、异常、traceId、账号类型
│  ├─ platform/              7 个平台模块：people statemachine audit dataimport storage escalation dict
│  ├─ business/              5 个业务模块：demand course lecturer training kase
│  ├─ aggregate/             3 个聚合模块：metrics warning worklist
│  └─ app/                   启动类、Web 层、权限拦截器、跨模块编排（AR-4）、ArchUnit 测试
├─ frontend/
│  └─ src/
│     ├─ app/                路由、24 页导航清单、全局壳层
│     ├─ shared/theme/       设计 Token → AntD 主题映射
│     ├─ shared/api/         HTTP 客户端与接口契约类型
│     └─ pages/              页面
├─ docker/                   Dockerfile 与 Nginx 配置
├─ scripts/                  前置检查、造数、备份、构建、部署
└─ docs/                     阶段自检报告
```

### 模块划分为什么是这样

15 个领域模块严格对应开发实施文档 4.2.1 的模块清单，一个不多一个不少。另有两个工程模块：

- **`common`**：公共基础设施，不含任何业务逻辑，且不依赖任何其他模块。
- **`app`**：架构图（4.2）里的「Web 层」与「权限拦截器」，同时是 AR-4 要求的跨模块编排位置。

15 个领域模块**没有各自的 `build.gradle.kts`**，公共约定写在根 `build.gradle.kts` 里；
需要模块专属依赖时（如 `dataimport` 要 EasyExcel）再新建。

两个命名细节值得记住：`kase` 而非 `case`（Java 与 SQL 保留字），`people` 而非 `iam`、
`escalation` 而非 `notify`——**包名是最强的隐性提示词**，`iam` 会诱导 AI 生成用户表与角色表，
`notify` 会诱导它生成 `send()` 方法，而这两样东西本项目都没有。

---

## 五、配置与敏感信息

| 环境 | 配置 | 口令 |
|---|---|---|
| 本地 | `application-local.yml` | `{noop}` 明文，便于调试 |
| 生产 | `application-prod.yml` + `.env` | **必须是 `{bcrypt}` 哈希**（规则 SEC5） |

生成口令哈希：

```powershell
cd backend; .\gradlew.bat :app:printPasswordHash -Ppassword='你的口令'
```

命令会打印两行，**`.env` 里必须填「.env 专用」那一行**——其中的 `$` 已转义成 `$$`。
BCrypt 哈希含 `$`，而 Docker Compose 会把 `.env` 值里的 `$xxx` 当变量插值成空串，
得到一个「`{bcrypt}$2a$10` 前缀完好、中间少一段」的残缺哈希。这个坑在阶段 0 踩过一次：
**应用照常启动、健康检查通过，只是登录永远失败，日志里没有任何线索指向 `.env`。**
现在启动自检会按完整长度（68 字符）校验哈希结构，填错直接启动失败并指出原因。

`.env` 不进 git。

`.env` 里还有两个必填的宿主机目录：

| 变量 | 说明 |
|---|---|
| `ATTACHMENT_DIR` | 附件目录，**必须是 Windows 路径**（如 `D:\aiacademy\attachments`） |
| `LOG_DIR` | 日志目录，同上 |

写成 `/data/...` 会让文件落进 WSL2 虚拟机内部，宿主机上的备份脚本与外置硬盘都访问不到。

生产环境若出现 `{noop}` 口令，`SharedAccountCredentialsCheck` 会让**应用启动失败**。
这是刻意设计的：共享账号下「口令一旦外泄即为全量写权限泄露」（AC4），而系统内没有第二道
防线（SEC6），所以把这类错误改成启动失败，而不是留到上线后才发现。

---

## 六、部署与备份

```powershell
Copy-Item .env.example .env    # 填写口令哈希、数据库口令与宿主机目录
powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1 -CreateDirs  # 前置检查，顺带建目录
powershell -ExecutionPolicy Bypass -File scripts\build.ps1   # 跑测试 + 构建镜像
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1  # 起服务，Flyway 自动迁移
```

**宿主机只需要 Docker。** JDK 17 与 Gradle 在 `docker/app/Dockerfile` 的构建段里，Node 在
`docker/web/Dockerfile` 的构建段里，PostgreSQL 15 是 compose 的一个容器——上面「一、本地启动」
那张 JDK／Node 版本表是给本地开发的，**不是部署前提**。仓库不会自动检测或安装宿主机环境。

`bootstrap.ps1` 是只读的前置检查（`-CreateDirs` 时才会创建附件与日志目录），`deploy.ps1`
起容器前也会自动跑它一遍，不通过就不做任何部署动作。它检查工具链、物理内存对得上 compose
的 29GB 限额、80 端口空闲、`.env` 五个必填项、两个哈希的结构，以及宿主机目录是不是盘符路径。

加这一道的理由是它拦的两类错误**在部署当时完全没有征兆**，健康检查对它们都是绿的：

- **`.env` 里 bcrypt 哈希的 `$` 未转义**，被 Docker Compose 当变量插值吃掉中间一段。应用照常
  启动、`/actuator/health` 返回 UP，只是登录永远失败，日志里没有任何线索指向 `.env`。脚本会
  先模拟一遍 Compose 的插值再比对——直接看 `.env` 里的字面量是看不出问题的，那时它还完好。
- **`ATTACHMENT_DIR` 写成 `/data/...`**，Docker 会把它当 WSL2 虚拟机内部的路径挂上去。容器
  读写附件全部正常，只有宿主机上的 `backup.ps1` 与外置硬盘永远看不到这些文件，直到某次真要
  恢复附件时才发现它们从没被备份过。

哈希校验用的正则与后端 `SharedAccountCredentialsCheck` 逐字一致（规则 SEC5）。**两处要一起改**：
这里放过的应用启动时照样会拒，这里比应用宽松就等于没检。

**备份必须在上线前配好，不能留到上线后。** 台式机作为服务器有三个结构性缺陷：无 RAID、
无冗余电源、无远程管理卡。外置硬盘每日备份是唯一兜底。

注册为每日 02:30 的计划任务（生产机是 Windows，没有 cron）：

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
             -Argument '-ExecutionPolicy Bypass -File D:\aiacademy\scripts\backup.ps1'
$trigger = New-ScheduledTaskTrigger -Daily -At 2:30am
Register-ScheduledTask -TaskName 'aiacademy-backup' -Action $action -Trigger $trigger `
             -User 'SYSTEM' -RunLevel Highest
```

脚本落地了 BK1～BK5 五条要求，其中两条特别容易被省掉：

- **BK3 备份完成后校验可恢复性**，不是只看脚本退出码。每天做 `pg_restore --list` 轻量验证，
  每月 1 号做真实恢复演练到临时库。**没验证过的备份等于没有备份。**
- **BK5 备份失败时在系统首页显示红色 Banner**。本项目没有任何外发通道（不做项第 4 条），
  邮件与短信告警都不存在。脚本把结果写进 `backup-status.json`，由首页读取——
  没有人会主动去看日志文件，但没有人能忽略首页的红条。（Banner 的前端实现在阶段 3。）

**BK4 的 Windows 实现方式：** 备份盘平时通过 `Set-Disk -IsOffline $true` 保持脱机，
脚本在备份窗口内联机、结束后重新脱机。目的是防止勒索软件或误删同时毁掉主盘与备份盘——
一块常驻挂载的备份盘在这两种场景下和主盘一起完蛋。
`.env` 里的 `BACKUP_DISK_NUMBER` 留空则跳过联机／脱机，按盘符已挂载处理。

### 前端演示站（Vercel）—— 只是给人看界面，不是第二套部署方式

生产部署只有上面那一种：单机三容器（C13／BLOCK-03）。**整套系统不能部署到 Vercel**——
Vercel 没有 Java 运行时，而且会话在 JVM 内存里（不做项第 18 条禁 Redis）、附件在本地磁盘、
定时任务要常驻进程，这三样在无状态的函数运行时上都不成立。

能放上去的只有前端，且必须是**演示构建**：数据全部来自 `src/fixtures`，一个接口都不发。

```powershell
cd frontend
npx vercel        # 首次会要求登录并创建项目，之后是预览部署
npx vercel --prod # 发到正式域名
```

`frontend/vercel.json` 里写死了 `VITE_DEMO_MODE=1`，**这个文件是为演示站存在的**：
它把该目录的任何 Vercel 部署都固定成演示构建。如果将来要用 Vercel 托管真前端并反代到
真后端，不要改这里的开关了事——那是另一件事，得先有一个公网可达的后端，
还要重新处理会话 Cookie 与 200MB 分片上传（Vercel 请求体上限 4.5MB，这条走不通，
上传必须绕开）。

**fixtures 里的日期会在运行时平移到今天**（`src/fixtures/fixtureClock.ts`）。这不是演示站专属的
处理：`resolveTrainingCalendar` 早就写着「产品模式反过来必须落在真实当月，否则运营打开就是
一张过期月历」，`fixtureClock` 只是把同一条口径推广到全部 fixture。判定与它一致——
**`?fixture=1` 的回归模式原样返回冻结值，其余模式一律平移**。文档 0.3 与 15.1 的「不得使用今天」
约束的是视觉回归，九张基线与多条 spec 断言比对的正是那批冻结值，所以那条分支必须原样保留。

平移而不是替换成今天：每个日期减去所属基准日再加今天，整批一起挪，这样「剩余 2 天」
「逾期 5 天」这些同样写死的天数仍与日期对得上。fixtures 有两个基准日（设计稿那批锚在
`2024-06-10`，`training.ts` 那批锚在 `2026-08-04`），按年份分派。编号里嵌的日期
（`TASK-2024-0612-001`、`AL2024050001`、`ST20240610001` 等）另用**整串匹配**的规则单独挪，
因为 `T-2405-09`、`JH-D13-01` 这类编号里也有形如日期的数字段，放开边界就会把编号改坏——
改坏之后仍是一个合法编号，列表照常渲染，只有点开详情才发现对不上。

演示模式的开关在 `src/app/demoMode.ts`，只读构建期变量、**没有任何运行期入口**：
正式构建不设这个变量，线上没人能靠改地址栏把自己切进演示态。相关代码在正式构建里
经摇树后零残留（JS 与 CSS 都验过）。它与 `?fixture=1` 的视觉回归模式只共用 fixtures，
判定各走各的——回归模式会关掉滚动与动画，拿来当演示会得到一个不能滚动的页面。

---

## 七、阶段进度

| 阶段 | 内容 | 页面 | 状态 |
|---|---|---|---|
| 0 | 工程骨架与决策关闭 | 0 | **已完成** |
| 1 | 平台底座与数据入口（状态机、双日志、权限、6 类导入、附件、并发） | 3 | **进行中**（1A/1B/1C 已完成，1D 待做） |
| 2 | 五驾驶舱业务主线 | 18 | 未开始 |
| 3 | 指标、总看板、三色灯、任务中心 | 2 | 未开始 |
| 4 | 催办台账、评审记录中心、导出 | 1 | 未开始 |
| 5 | 硬化、UAT 与上线 | 0 | 未开始 |

阶段 0 的临时产物已在 1C 全部清除：骨架示例四层代码、它的 Mapper XML、示例表
（`V1_009__drop_skeleton_sample.sql`），以及总看板壳层与冒烟测试里对示例接口的调用——
后两者改指到导入中心与附件接口。选它们的原因是导入是一期唯一的数据入口，
冒烟测试从此打的是真实业务路径。

留下的只有 `V0_001` 里的 `pg_trgm` 扩展：阶段 2 的名称模糊搜索要用（16.1.5）。
