# 造数（Windows 开发机）。用法：powershell -ExecutionPolicy Bypass -File scripts\seed\seed.ps1
#                          单机形态换过库端口时：... -File scripts\seed\seed.ps1 -DbPort 15450
#
# 依赖：库已起，且 app 至少启动过一次（Flyway 迁移完成）。两种形态都行，_sql-runner.ps1 自己认：
#   Docker 形态 ：docker compose -f docker-compose.local.yml up -d
#   单机形态    ：cd dist-standalone; .\start.ps1
#
# 为什么 Docker 那条路是先 docker cp 再 psql -f，而不是把 SQL 文本管道喂给 psql：
# Windows PowerShell 5.1 向原生进程传管道文本时会按控制台代码页重新编码，
# 脚本里的中文会被替换成「?」并真的以 0x3F 存进数据库（验证过：encode(...,'hex') = 3f3f）。
# docker cp 是字节级复制，不经过任何编码转换。单机那条路走 JDBC，全程 UTF-8，没有这个问题。

param(
    [int]$DbPort = 15432,
    # auto：两个库都在时优先 Docker。指定 -DbPort 却撞上 Docker 在跑时会报错要求说清楚，
    # 不会静默打到另一个库上（见 _sql-runner.ps1 里 Invoke-SqlFile 的注释）
    [ValidateSet('auto', 'docker', 'standalone')][string]$Mode = 'auto'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir '_sql-runner.ps1')

$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
Invoke-SqlFile -SqlFile (Join-Path $scriptDir 'seed.sql') -RepoRoot $repoRoot -DbPort $DbPort -Mode $Mode -DbPortExplicit $PSBoundParameters.ContainsKey('DbPort')

Write-Host ('造数完成：org_employee 100 条（其中 20 条离职）+ biz_demand 1 条（状态停滞 12 天）' +
    ' + 培训链路 1 套（课程／计划／讲师／场次 JH2026070001-01，已结束）。')
