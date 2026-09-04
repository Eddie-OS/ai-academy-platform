# 阶段 5 性能造数（P1／P2／P3／P6）。日常演示不要跑——会造 1 万门课，总看板红灯上万。
# 日常请用：powershell -ExecutionPolicy Bypass -File scripts\seed\seed.ps1
#
# 用法：powershell -ExecutionPolicy Bypass -File scripts\seed\seed-perf.ps1
#      单机形态换过库端口时：... -File scripts\seed\seed-perf.ps1 -DbPort 15450
#
# 依赖：库已起，且 app 至少启动过一次（Flyway 迁移完成）。Docker 与单机两种形态都支持，
# 由 _sql-runner.ps1 自动判断走哪条路。

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
Invoke-SqlFile -SqlFile (Join-Path $scriptDir 'seed-perf.sql') -RepoRoot $repoRoot -DbPort $DbPort -Mode $Mode -DbPortExplicit $PSBoundParameters.ContainsKey('DbPort')

Write-Host '性能造数完成：课程 10000 + 签到 20000 + 浏览 100000（前缀 PERF-）'
