# 阶段 5 性能造数（P6）。日常演示不要跑——会造 1 万门课，总看板红灯上万。
# 日常请用：powershell -ExecutionPolicy Bypass -File scripts\seed\seed.ps1
# 用法：powershell -ExecutionPolicy Bypass -File scripts\seed\seed-perf.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$seedFile = Join-Path $scriptDir 'seed-perf.sql'
$container = 'aiacademy-postgres-local'

$running = docker ps --filter "name=$container" --format '{{.Names}}'
if ($running -ne $container) {
    throw "容器 $container 未运行。先执行：docker compose -f docker-compose.local.yml up -d"
}

docker cp $seedFile "${container}:/tmp/seed-perf.sql"
if ($LASTEXITCODE -ne 0) { throw 'docker cp 失败' }

docker exec -e PGCLIENTENCODING=UTF8 $container `
    psql -U aiacademy -d aiacademy -v ON_ERROR_STOP=1 -f /tmp/seed-perf.sql
if ($LASTEXITCODE -ne 0) { throw '性能造数失败' }

Write-Host '性能造数完成：课程 10000 + 签到 20000 + 浏览 100000（前缀 PERF-）'
