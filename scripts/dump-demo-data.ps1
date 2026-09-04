# 重新生成本地演示数据种子：把当前本地库里的业务数据导成 db/demo/demo-data.sql。
#
# 什么时候要跑它：你在界面上把演示数据改成了更合适的样子，想让别人克隆下来也拿到这一份。
#
# 前提：docker-compose.local.yml 起的 aiacademy-postgres-local 正在运行。
# 用法：pwsh scripts/dump-demo-data.ps1

$ErrorActionPreference = 'Stop'

$container = 'aiacademy-postgres-local'
$target = Join-Path $PSScriptRoot '..\backend\app\src\main\resources\db\demo\demo-data.sql'

# 顺序在这里无关紧要（pg_dump 自己按字母序排，靠 session_replication_role 兜外键），
# 但这份清单必须与 DemoDataSeeder.SEEDED_TABLES 逐字一致 —— 那边少一张就会灌出半份数据。
$tables = @(
    'org_employee', 'biz_demand', 'biz_course', 'biz_lecturer', 'biz_case',
    'biz_training_plan', 'biz_training_session', 'rel_demand_course',
    'dtl_demand_review', 'dtl_demand_acceptance', 'dtl_course_material_version',
    'dtl_attendance', 'dtl_training_archive',
    'dtl_case_view', 'dtl_case_like', 'dtl_case_comment', 'dtl_escalation_record',
    'audit_state_log', 'sys_task'
)

if (-not (docker ps --filter "name=$container" --format '{{.Names}}')) {
    throw "容器 $container 没在运行。先执行：docker compose -f docker-compose.local.yml up -d"
}

Write-Host "从 $container 导出 $($tables.Count) 张表…"

$tableArgs = $tables | ForEach-Object { '-t'; $_ }
# --column-inserts 而不是默认的 COPY：COPY ... FROM stdin 是 psql 客户端特性，
# DemoDataSeeder 走 JDBC 执行，遇到 COPY 会在第一张表就停下
docker exec $container pg_dump -U aiacademy -d aiacademy `
    --data-only --no-owner --no-privileges --column-inserts `
    @tableArgs -f /tmp/demo-data.sql
if ($LASTEXITCODE -ne 0) { throw "pg_dump 失败，退出码 $LASTEXITCODE" }

$tmp = New-TemporaryFile
docker cp "${container}:/tmp/demo-data.sql" $tmp.FullName
docker exec $container rm -f /tmp/demo-data.sql

# 反斜杠开头的是 psql 元命令（\restrict / \unrestrict），JDBC 执行不了，必须剥掉
$body = (Get-Content $tmp.FullName -Encoding UTF8) | Where-Object { $_ -notmatch '^\\' }
Remove-Item $tmp.FullName

$existing = Get-Content $target -Encoding UTF8
$headerEnd = ($existing | Select-String -Pattern '^SET session_replication_role = replica;' | Select-Object -First 1).LineNumber
if (-not $headerEnd) { throw "$target 里找不到 header 结束标记，不敢覆盖。请人工检查。" }

# 头注是手写的，不能被导出内容冲掉：只换 body，保留原文件开头那段说明
$header = $existing[0..($headerEnd - 1)]
$text = ($header -join "`n") + "`n`n" + ($body -join "`n") + "`n`nSET session_replication_role = DEFAULT;`n"
[System.IO.File]::WriteAllText(
    (Resolve-Path $target), $text, (New-Object System.Text.UTF8Encoding($false)))

$inserts = ($body | Select-String -Pattern '^INSERT INTO').Count
Write-Host "完成：$inserts 条 INSERT 写入 db/demo/demo-data.sql"
Write-Host '记得跑一次空库实测：docker compose -f docker-compose.local.yml down -v 然后重新 up + bootRun'
