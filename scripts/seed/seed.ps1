# 造数（Windows 开发机）。用法：powershell -ExecutionPolicy Bypass -File scripts\seed\seed.ps1
# 依赖：docker-compose.local.yml 已起库，且 app 至少启动过一次（Flyway 迁移完成）。
#
# 为什么先 docker cp 再 psql -f，而不是把 SQL 文本管道喂给 psql：
# Windows PowerShell 5.1 向原生进程传管道文本时会按控制台代码页重新编码，
# 脚本里的中文会被替换成「?」并真的以 0x3F 存进数据库（验证过：encode(...,'hex') = 3f3f）。
# docker cp 是字节级复制，不经过任何编码转换。

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$seedFile = Join-Path $scriptDir 'seed.sql'
$container = 'aiacademy-postgres-local'

$running = docker ps --filter "name=$container" --format '{{.Names}}'
if ($running -ne $container) {
    throw "容器 $container 未运行。先执行：docker compose -f docker-compose.local.yml up -d"
}

docker cp $seedFile "${container}:/tmp/seed.sql"
if ($LASTEXITCODE -ne 0) { throw 'docker cp 失败' }

# PGCLIENTENCODING 显式声明 UTF8：容器 locale 是 C，不声明的话 psql 会按 SQL_ASCII 解读文件。
docker exec -e PGCLIENTENCODING=UTF8 $container `
    psql -U aiacademy -d aiacademy -v ON_ERROR_STOP=1 -f /tmp/seed.sql
if ($LASTEXITCODE -ne 0) { throw '造数失败' }

Write-Host '造数完成：org_employee 100 条（其中 20 条离职）+ biz_demand 1 条（状态停滞 12 天）。'
