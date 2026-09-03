# 上线前置检查。在 docker compose up 之前，把「容器起得来但系统用不了」的配置错误拦下来。
#
# 为什么单独加这一道：deploy.ps1 的前置检查只有「.env 是否存在」，而两个真实踩过的坑都能
# 大摇大摆通过那道检查——
#   其一，.env 里 bcrypt 哈希的 $ 未转义，被 Docker Compose 当变量插值吃掉中间一段。
#   应用照常启动、健康检查通过，只是登录永远失败，且日志里没有任何线索指向 .env
#   （阶段 0 为它排查了六次失败启动，见 docs/E0-自检报告.md）。
#   其二，ATTACHMENT_DIR 写成 /data/... 会落进 WSL2 虚拟机内部，宿主机上的备份脚本与
#   外置硬盘都碰不到它，直到某次真要恢复附件时才发现三个月的附件从没被备份过。
# 这两类错误的共同点是「部署当时一切正常」。事后没有任何征兆能提醒你，所以必须在起容器
# 之前检，而不是等健康检查——健康检查对这两条都是绿的。
#
# 本脚本只读，不安装任何东西：宿主机上装什么由运维决定（见 README「一、本地启动」）。
# 唯一的写操作是 -CreateDirs 时创建缺失的附件与日志目录。
#
# 用法：powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1
#       powershell -ExecutionPolicy Bypass -File scripts\bootstrap.ps1 -CreateDirs

[CmdletBinding()]
param(
    # 创建 ATTACHMENT_DIR 与 LOG_DIR。不加则只报告缺失。
    [switch]$CreateDirs
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

$script:fail = 0
$script:warn = 0

function Pass($name, $detail) {
    Write-Host "  PASS  $name" -ForegroundColor Green
    if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
}

function Fail($name, $detail) {
    Write-Host "  FAIL  $name" -ForegroundColor Red
    Write-Host "        $detail" -ForegroundColor Red
    $script:fail++
}

function Warn($name, $detail) {
    Write-Host "  WARN  $name" -ForegroundColor Yellow
    Write-Host "        $detail" -ForegroundColor Yellow
    $script:warn++
}

# .env 的极简解析。只按第一个 = 切分，注释与空行跳过。
# 用 ReadAllLines 而不是 Get-Content：前者按 BOM 自动识别 UTF-8，
# 后者在 PowerShell 5.1 上按系统代码页读，中文注释行会变成乱码（虽然我们跳过注释，
# 但一旦有人在值里写了中文路径就会静默读错）。
function Read-DotEnv([string]$path) {
    $map = @{}
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $sep = $trimmed.IndexOf('=')
        if ($sep -lt 1) { continue }
        $map[$trimmed.Substring(0, $sep).Trim()] = $trimmed.Substring($sep + 1).Trim()
    }
    return $map
}

# 模拟 Docker Compose 对 .env 值做的插值：$$ 是转义后的字面 $，剩下的 $NAME 与 ${NAME}
# 会被替换成变量值（未定义时为空串）。
#
# 这一步是本脚本存在的理由。直接拿 .env 里的字面量去比对，看到的是转义前的样子，
# 和容器里实际收到的不是同一个串——转义写错时字面量看着完全正常。必须先模拟一遍插值，
# 才能看见 app 启动时真正拿到的那个值。
function Expand-ComposeValue([string]$raw) {
    $sentinel = [string][char]0x1
    $escaped = $raw.Replace('$$', $sentinel)

    # 转义处理完还剩下的 $xxx，就是会被 Compose 吃掉的部分
    $eaten = [regex]::Matches($escaped, '\$\{?[A-Za-z0-9_]+\}?') | ForEach-Object { $_.Value }

    $expanded = [regex]::Replace($escaped, '\$\{?[A-Za-z0-9_]+\}?', '')
    [pscustomobject]@{
        Value = $expanded.Replace($sentinel, '$')
        Eaten = @($eaten)
    }
}

# 与后端 SharedAccountCredentialsCheck.BCRYPT 保持逐字一致（规则 SEC5）。
# 两处都改才有意义：这里放过的，应用启动时照样会拒；这里比应用宽松，就等于没检。
$BCRYPT_PATTERN = '^\{bcrypt}\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$'

Write-Host ''
Write-Host '=== 上线前置检查 ===' -ForegroundColor Cyan

Write-Host ''
Write-Host '--- 一、工具链 ---' -ForegroundColor Cyan

# 宿主机只需要 Docker：JDK 17 与 Gradle 在 docker/app/Dockerfile 的构建段里，
# Node 在 docker/web/Dockerfile 的构建段里，PostgreSQL 是 compose 的一个容器。
# README「一、本地启动」那张 JDK／Node 版本表是给本地开发的，不是部署前提。
$dockerReady = $false
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'docker 命令可用' '未找到 docker。生产机装 Docker Desktop 4.80+（含 compose v2），见 README 一、本地启动'
} else {
    $serverVersion = docker info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $serverVersion) {
        Fail 'Docker 守护进程在运行' 'docker info 失败。Docker Desktop 未启动，或当前账号不在 docker-users 组'
    } else {
        Pass 'Docker 守护进程在运行' "引擎版本 $serverVersion"
        $dockerReady = $true
    }

    $composeVersion = docker compose version --short 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $composeVersion) {
        Fail 'docker compose v2 可用' 'docker compose 子命令不可用。旧版 docker-compose(v1) 不支持本项目 compose 文件里的 deploy.resources 限额'
        $dockerReady = $false
    } else {
        $major = ($composeVersion -replace '^v', '' -split '\.')[0]
        if ([int]$major -lt 2) {
            Fail 'docker compose v2 可用' "当前 $composeVersion，需要 v2 及以上"
            $dockerReady = $false
        } else {
            Pass 'docker compose v2 可用' "compose $composeVersion"
        }
    }
}

Write-Host ''
Write-Host '--- 二、宿主机资源 ---' -ForegroundColor Cyan

# docker-compose.yml 给三个容器设了内存硬限额，合计 29GB（postgres 16 + app 12 + nginx 1）。
# 物理内存不足会让限额失去意义：容器还没碰到上限，操作系统就已经开始 swap，
# 于是「导入变慢 → 请求堆积 → 堆继续涨」的连锁反应照样发生，而这正是设限额要避免的。
$totalGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($totalGb -lt 32) {
    Warn '物理内存够 compose 限额' "本机 $totalGb GB，compose 三容器限额合计 29GB。内存不足时限额形同虚设，操作系统会先 swap"
} else {
    Pass '物理内存够 compose 限额' "本机 $totalGb GB（限额合计 29GB）"
}

# nginx 是唯一映射到宿主机的端口（80:80）。被占用时 compose up 会失败，
# 但失败信息是 docker 的端口绑定错误，容易被当成 Docker 本身的问题。
try {
    $occupied = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
    if ($occupied) {
        $holders = ($occupied | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } |
            Where-Object { $_ } | Sort-Object -Unique) -join ', '
        Warn '80 端口空闲' "已被占用（$holders）。nginx 映射 80:80，需先停掉占用方，或改 docker-compose.yml 的 ports"
    } else {
        Pass '80 端口空闲' 'nginx 可绑定 80:80'
    }
} catch {
    Warn '80 端口空闲' "无法检测端口占用：$($_.Exception.Message)"
}

Write-Host ''
Write-Host '--- 三、.env 必填项 ---' -ForegroundColor Cyan

if (-not (Test-Path .env)) {
    Fail '.env 存在' '缺少 .env：Copy-Item .env.example .env 后按注释填写'
    Write-Host ''
    Write-Host '.env 不存在，后续检查无从进行。' -ForegroundColor Red
    exit 1
}
Pass '.env 存在' $null

$dotenv = Read-DotEnv '.env'

# 这五项在 docker-compose.yml 里用 ${VAR:?...} 声明为必填，缺任何一个 compose 直接拒绝启动。
# DB_NAME 与 DB_USER 有默认值 aiacademy，故不在此列。
foreach ($key in @('DB_PASSWORD', 'OPERATOR_PASSWORD_HASH', 'VIEWER_PASSWORD_HASH', 'ATTACHMENT_DIR', 'LOG_DIR')) {
    if (-not $dotenv.ContainsKey($key) -or -not $dotenv[$key]) {
        Fail "$key 已填写" 'docker-compose.yml 里声明为必填（${VAR:?...}），留空会被 compose 拒绝'
    } else {
        Pass "$key 已填写" $null
    }
}

# 本地开发口令 aiacademy 写在 docker-compose.local.yml 与 application-local.yml 里，
# 这两个文件在公开仓库中人人可读。沿用到生产等于把库口令公开。
if ($dotenv['DB_PASSWORD'] -eq 'aiacademy') {
    Warn 'DB_PASSWORD 不是本地开发口令' '当前值与 docker-compose.local.yml 里的开发口令相同，而该文件在公开仓库中可读，生产必须换掉'
}

Write-Host ''
Write-Host '--- 四、共享账号口令哈希（规则 SEC5）---' -ForegroundColor Cyan

$hashes = @{}
foreach ($item in @(
        @{ Key = 'OPERATOR_PASSWORD_HASH'; Label = '运营账号' },
        @{ Key = 'VIEWER_PASSWORD_HASH'; Label = '用户账号' }
    )) {
    $key = $item.Key
    $label = $item.Label
    $raw = $dotenv[$key]
    if (-not $raw) { continue }

    $result = Expand-ComposeValue $raw
    $hashes[$key] = $result.Value

    if ($result.Eaten.Count -gt 0) {
        $eatenText = ($result.Eaten -join '、')
        Fail "$label 哈希的 `$ 已转义" ("值里有未转义的 `$：$eatenText 会被 Compose 当变量插值成空串，" +
            "容器实际收到「$($result.Value)」。改用 gradlew :app:printPasswordHash 输出的「.env 专用」那一行，其中 `$ 已写成 `$`$")
    } elseif ($result.Value -notmatch $BCRYPT_PATTERN) {
        Fail "$label 哈希结构完整" ("插值后长度 $($result.Value.Length)，应为 68（{bcrypt} + `$2a`$10`$ + 53 位）。" +
            '应用启动时 SharedAccountCredentialsCheck 会用同一个正则拒绝它')
    } else {
        Pass "$label 哈希结构完整" '插值后 68 位，与后端校验正则一致'
    }
}

# 两个账号的写权限天差地别：运营全量可写，用户账号只有点赞与评论两个接口（规则 PM1）。
# 口令相同意味着拿到用户口令的人可以直接登运营账号，权限模型当场失效。
if ($hashes['OPERATOR_PASSWORD_HASH'] -and $hashes['OPERATOR_PASSWORD_HASH'] -eq $hashes['VIEWER_PASSWORD_HASH']) {
    Fail '两账号哈希不相同' '运营与用户账号用了同一个口令。用户账号只能点赞评论，运营账号全量可写（PM1），口令相同等于权限模型不存在'
}

Write-Host ''
Write-Host '--- 五、宿主机目录（BLOCK-05）---' -ForegroundColor Cyan

foreach ($item in @(
        @{ Key = 'ATTACHMENT_DIR'; Label = '附件目录'; MinFreeGb = 200 },
        @{ Key = 'LOG_DIR'; Label = '日志目录'; MinFreeGb = 10 }
    )) {
    $key = $item.Key
    $label = $item.Label
    $path = $dotenv[$key]
    if (-not $path) { continue }

    # 生产机是 Windows。这两个值是 compose 的 volume 宿主侧路径，写成 /data/... 时
    # compose 不会报错，Docker 会把它当 WSL2 虚拟机内部的路径挂上去——容器读写都正常，
    # 只有宿主机上的 backup.ps1 与外置硬盘永远看不到这些文件。
    if ($path -notmatch '^[A-Za-z]:\\') {
        Fail "$key 是 Windows 宿主路径" "当前「$path」不是盘符路径。写成 /data/... 会落进 WSL2 虚拟机内部，宿主机的 backup.ps1 与外置硬盘都碰不到，附件将从未被备份"
        continue
    }
    Pass "$key 是 Windows 宿主路径" $path

    $drive = $path.Substring(0, 2)
    if ($drive -ieq 'C:') {
        Warn "$key 不在系统盘" '放在 C: 会与操作系统争空间；.env.example 要求避开系统盘，附件按 2TB 规划'
    }

    if (-not (Test-Path $path)) {
        if ($CreateDirs) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Pass "$label 已存在" "本次已创建 $path"
        } else {
            Warn "$label 已存在" "$path 不存在。加 -CreateDirs 创建，或手工建好——Docker 会自作主张创建缺失的挂载点，届时属主与权限未必是你要的"
            continue
        }
    } else {
        Pass "$label 已存在" $path
    }

    try {
        $freeGb = [math]::Round((Get-PSDrive $drive.Substring(0, 1) -ErrorAction Stop).Free / 1GB, 1)
        if ($freeGb -lt $item.MinFreeGb) {
            Warn "$label 剩余空间" "$drive 剩 $freeGb GB，低于建议的 $($item.MinFreeGb) GB"
        } else {
            Pass "$label 剩余空间" "$drive 剩 $freeGb GB"
        }
    } catch {
        Warn "$label 剩余空间" "无法读取 $drive 的剩余空间：$($_.Exception.Message)"
    }
}

Write-Host ''
Write-Host '--- 六、备份配置（BK1～BK5）---' -ForegroundColor Cyan

# 备份必须在上线前配好。台式机作服务器无 RAID、无冗余电源、无远程管理卡，
# 外置硬盘每日备份是唯一兜底（README 六、部署与备份）。
if (-not $dotenv['BACKUP_STATUS_FILE']) {
    Warn 'BACKUP_STATUS_FILE 已填写' '留空则 backup.ps1 无处写状态，首页的备份失败告警 Banner（BK5）永远不会亮——备份哪天开始失败没人会知道'
} else {
    Pass 'BACKUP_STATUS_FILE 已填写' $dotenv['BACKUP_STATUS_FILE']
}

if (-not $dotenv['BACKUP_DRIVE']) {
    Warn 'BACKUP_DRIVE 已填写' '留空则 backup.ps1 不知道往哪个盘备份'
} else {
    Pass 'BACKUP_DRIVE 已填写' $dotenv['BACKUP_DRIVE']
}

Write-Host ''
Write-Host '--- 七、compose 配置解析 ---' -ForegroundColor Cyan

# 交给 compose 自己再验一遍。上面逐项检查是为了给出可操作的原因，
# 这一步兜住我们没想到的组合问题（YAML 语法、其它 ${VAR:?} 声明、卷与网络定义）。
if (-not $dockerReady) {
    Warn 'docker compose config 通过' 'Docker 不可用，跳过'
} else {
    # 这里必须临时放开 ErrorActionPreference。compose 把「变量未定义，按空串处理」这类提示
    # 写到 stderr，而 2>&1 会把 stderr 变成 ErrorRecord；在 Stop 之下它是终止性错误，
    # 脚本会在打印小结之前就中断——恰好在配置最可疑的时候丢掉整份报告。
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $composeOutput = (docker compose config --quiet 2>&1 | Out-String).Trim()
        $composeExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousEap
    }

    if ($composeExit -ne 0) {
        Fail 'docker compose config 通过' $composeOutput
    } elseif ($composeOutput) {
        # 退出码 0 但有输出：compose 能解析，只是有话说。多半是某个 ${VAR} 未定义被按空串处理，
        # 值得看一眼是不是又一次 $ 转义写错。
        Warn 'docker compose config 无提示' $composeOutput
    } else {
        Pass 'docker compose config 通过' '三个服务定义与全部必填变量均可解析'
    }
}

Write-Host ''
Write-Host '=== 小结 ===' -ForegroundColor Cyan
Write-Host "  失败 $script:fail 项，警告 $script:warn 项。"

if ($script:fail -gt 0) {
    Write-Host ''
    Write-Host '存在失败项，不要继续部署——上面每条 FAIL 都会让系统「起得来但用不了」。' -ForegroundColor Red
    exit 1
}

if ($script:warn -gt 0) {
    Write-Host ''
    Write-Host '无失败项。警告不阻断部署，但请逐条确认是有意如此。' -ForegroundColor Yellow
} else {
    Write-Host ''
    Write-Host '全部通过，可以执行 scripts\deploy.ps1。' -ForegroundColor Green
}
exit 0
