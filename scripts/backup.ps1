# =============================================================================
# 每日备份。《开发实施文档》3.5：备份必须在阶段 0 就做完，不能留到上线前。
#
# 台式机作为服务器有三个结构性缺陷：无 RAID（单盘故障即全部数据丢失）、
# 无冗余电源（断电可能损坏数据文件）、无远程管理卡（宕机后需要人到现场）。
# 外置硬盘每日自动备份是唯一的兜底。
#
# 落地的五条要求：
#   BK1 每日 1 次全量 pg_dump，保留最近 14 份
#   BK2 附件目录每日增量同步
#   BK3 备份完成后校验可恢复性，不是只看退出码
#   BK4 外置硬盘平时不挂载为固定路径，脚本挂载后卸载
#   BK5 备份失败时在系统首页显示 Banner 告警
#
# 部署（生产机为 Windows，BLOCK-05）——注册为每日 02:30 的计划任务：
#   $action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
#                -Argument '-ExecutionPolicy Bypass -File D:\aiacademy\scripts\backup.ps1'
#   $trigger = New-ScheduledTaskTrigger -Daily -At 2:30am
#   Register-ScheduledTask -TaskName 'aiacademy-backup' -Action $action -Trigger $trigger `
#                -User 'SYSTEM' -RunLevel Highest
# =============================================================================

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

# --- 读 .env ------------------------------------------------------------------
$config = @{}
$envFile = Join-Path $repoRoot '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
            $config[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
}
function Cfg($key, $fallback) {
    if ($config.ContainsKey($key) -and $config[$key]) { return $config[$key] }
    return $fallback
}

$dbName        = Cfg 'DB_NAME' 'aiacademy'
$dbUser        = Cfg 'DB_USER' 'aiacademy'
$attachmentDir = Cfg 'ATTACHMENT_DIR' 'D:\aiacademy\attachments'
$backupDrive   = (Cfg 'BACKUP_DRIVE' 'E:').TrimEnd('\')
$diskNumber    = Cfg 'BACKUP_DISK_NUMBER' ''
$statusFile    = Cfg 'BACKUP_STATUS_FILE' 'D:\aiacademy\backup-status.json'
$keepDumps     = 14

$stamp = Get-Date -Format 'yyyyMMdd'
$script:mounted = $false

# BK5：没有人会主动去看日志文件，但没有人能忽略首页的红条
function Write-Status($ok, $message) {
    $dir = Split-Path -Parent $statusFile
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $payload = [ordered]@{
        ok         = $ok
        finishedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
        message    = $message
    }
    $payload | ConvertTo-Json -Compress | Set-Content -Path $statusFile -Encoding UTF8
}

function Dismount-BackupDisk {
    if (-not $script:mounted -or -not $diskNumber) { return }
    try {
        Set-Disk -Number $diskNumber -IsOffline $true
        $script:mounted = $false
    } catch {
        Write-Warning "外置硬盘脱机失败，请人工检查：$($_.Exception.Message)"
    }
}

function Fail($message) {
    Write-Host "[备份失败] $message" -ForegroundColor Red
    Write-Status $false $message
    Dismount-BackupDisk
    exit 1
}

Write-Host "===== 备份开始 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====="

# --- BK4：挂载外置硬盘 ---------------------------------------------------------
# 平时保持脱机，防止勒索软件或误删同时毁掉主盘与备份盘。
if ($diskNumber) {
    try {
        Set-Disk -Number $diskNumber -IsOffline $false
        Set-Disk -Number $diskNumber -IsReadOnly $false
        Start-Sleep -Seconds 5
        $script:mounted = $true
    } catch {
        Fail "外置硬盘联机失败（磁盘 $diskNumber）：$($_.Exception.Message)"
    }
}
if (-not (Test-Path "$backupDrive\")) {
    Fail "备份盘 $backupDrive 不可访问。检查外置硬盘是否连接、BACKUP_DISK_NUMBER 是否正确"
}

$dumpDir   = Join-Path "$backupDrive\" 'pgdump'
$attachDst = Join-Path "$backupDrive\" 'attachments'
New-Item -ItemType Directory -Path $dumpDir, $attachDst -Force | Out-Null

# --- BK1：全量 pg_dump ---------------------------------------------------------
# 先在容器内导出到文件再 docker cp 出来：PowerShell 的管道会对字节流做编码转换，
# 直接把 pg_dump 的二进制输出重定向到宿主机文件会损坏 dump（造数脚本踩过同一个坑）。
$dumpName = "$dbName-$stamp.dump"
$dumpFile = Join-Path $dumpDir $dumpName

docker compose exec -T postgres pg_dump -U $dbUser -d $dbName -Fc -f "/tmp/$dumpName"
if ($LASTEXITCODE -ne 0) { Fail 'pg_dump 执行失败' }

docker compose cp "postgres:/tmp/$dumpName" $dumpFile
if ($LASTEXITCODE -ne 0) { Fail 'dump 文件拷出容器失败' }

if (-not (Test-Path $dumpFile) -or (Get-Item $dumpFile).Length -eq 0) {
    Fail 'pg_dump 产生了空文件'
}

# --- BK3：验证可恢复性。没验证过的备份等于没有备份 --------------------------------
# 每天做轻量验证（pg_restore --list 能完整列出对象清单）；每月 1 号做真实恢复演练。
docker compose exec -T postgres pg_restore --list "/tmp/$dumpName" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail '备份文件无法被 pg_restore 解析，本次备份不可用' }

if ((Get-Date -Format 'dd') -eq '01') {
    Write-Host '--- 月度恢复演练 ---'
    $restoreDb = "${dbName}_restore_test"
    docker compose exec -T postgres dropdb -U $dbUser --if-exists $restoreDb | Out-Null
    docker compose exec -T postgres createdb -U $dbUser $restoreDb
    if ($LASTEXITCODE -ne 0) { Fail '恢复演练：临时库创建失败' }

    docker compose exec -T postgres pg_restore -U $dbUser -d $restoreDb "/tmp/$dumpName" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail '恢复演练：恢复失败' }

    $rows = docker compose exec -T postgres psql -U $dbUser -d $restoreDb -tAc `
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    if ([int]($rows -replace '\D', '') -le 0) { Fail '恢复演练：恢复后的库里没有任何表' }

    docker compose exec -T postgres dropdb -U $dbUser $restoreDb | Out-Null
    Write-Host "恢复演练通过，恢复后表数量：$rows"
}

docker compose exec -T postgres rm -f "/tmp/$dumpName" | Out-Null

# --- BK1：只保留最近 14 份 -----------------------------------------------------
Get-ChildItem -Path $dumpDir -Filter "$dbName-*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $keepDumps |
    ForEach-Object {
        Write-Host "删除过期备份：$($_.Name)"
        Remove-Item $_.FullName -Force
    }

# --- BK2：附件目录增量同步（440 GB 全量拷贝太慢，必须增量）------------------------
if (Test-Path $attachmentDir) {
    # robocopy 的退出码 0～7 都是成功语义（8 起才是失败），不能按 -ne 0 判断。
    robocopy $attachmentDir $attachDst /MIR /R:2 /W:5 /NFL /NDL /NP /NJH | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "附件目录同步失败，robocopy 退出码 $LASTEXITCODE" }
} else {
    Write-Host '附件目录尚不存在（阶段 1 才有附件），跳过'
}

Dismount-BackupDisk
Write-Status $true '备份成功'
Write-Host "===== 备份完成 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====="
