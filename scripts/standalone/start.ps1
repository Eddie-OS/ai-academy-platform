#Requires -Version 5.1
<#
.SYNOPSIS
    单机模式启动 AI学院联合作战平台（无 Docker、无外部数据库）。

.DESCRIPTION
    一个进程包办三件事：内嵌 PostgreSQL 15、后端 API、前端静态文件。
    原本的生产形态是 docker compose 起 app + postgres + nginx 三个容器（C13／BLOCK-03），
    内网机器装不了 Docker，因此换成这条路。数据库仍是真正的 PostgreSQL 15，
    只是二进制打在 app.jar 里、启动时解包直接跑，见 EmbeddedPostgresBootstrap 的类注释。

    需要的运行时只有一个 JRE 17+。不需要 Docker、不需要装 PostgreSQL、不需要管理员权限。

.EXAMPLE
    .\start.ps1
    .\start.ps1 -Port 8080
#>
[CmdletBinding()]
param(
    # 对外服务端口。默认 80；被占用时换一个，前端与接口同源，改这一个就够
    [int]$Port = 80,

    # 内嵌数据库监听端口。只监听 localhost，一般不需要改
    [int]$DbPort = 15432
)

$ErrorActionPreference = 'Stop'

<#
切到脚本所在目录。

data/pgdata、web/、logs/ 全是相对路径，按进程工作目录解析。从别处调用时
（任务计划程序的默认工作目录是 C:\Windows\System32）会在那儿建一个新库，
而新库能正常建起来、迁移能正常跑完——于是「我的数据不见了」表现为一个
完全健康的空库，没有任何错误信息指向工作目录。
#>
Set-Location -Path $PSScriptRoot

$failures = New-Object System.Collections.Generic.List[string]
function Fail([string]$msg) { $failures.Add($msg); Write-Host "  FAIL  $msg" -ForegroundColor Red }
function Pass([string]$msg) { Write-Host "  OK    $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "  WARN  $msg" -ForegroundColor Yellow }

Write-Host ''
Write-Host '启动前检查' -ForegroundColor Cyan
Write-Host '----------------------------------------'

# --- Java ---------------------------------------------------------------------
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Fail '找不到 java。请安装 JRE/JDK 17 或以上，并确认 java 在 PATH 里'
} else {
    <#
    java -version 把版本号写在 stderr 上（历代如此，不是 bug）。

    捕获它必须先把 $ErrorActionPreference 放回 Continue：本脚本开头设了 Stop，
    而在 Stop 之下，把原生命令的 stderr 重定向进管道（2>&1）会被 PowerShell 当成
    终止性错误抛出 NativeCommandError —— 于是 java 明明装着、也能跑，脚本却报
    「找不到 java」。这一条在开发机上交互式执行时不会重现（交互式会话默认 Continue），
    只在正式跑脚本时出现，也就是只在目标机器上出现。

    版本串的格式历代不同：1.8.0_412（旧）／17.0.11／21.0.3。
    取第一段，是 1 就再取第二段。
    #>
    $javaMajor = 0
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $versionText = (& java -version 2>&1 | Out-String)
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($versionText -match 'version "(\d+)(?:\.(\d+))?') {
        $javaMajor = if ($Matches[1] -eq '1') { [int]$Matches[2] } else { [int]$Matches[1] }
    }

    if ($javaMajor -ge 17) {
        Pass "Java $javaMajor"
    } elseif ($javaMajor -gt 0) {
        Fail "Java 版本过低（当前 $javaMajor，需要 17+）。后端按 Java 17 LTS 编译，低版本会在启动时报 UnsupportedClassVersionError"
    } else {
        Fail "认不出 java 版本，原始输出：$($versionText.Trim())"
    }
}

# --- 交付物 -------------------------------------------------------------------
if (Test-Path 'app.jar') {
    Pass ("app.jar（{0:N1} MB）" -f ((Get-Item 'app.jar').Length / 1MB))
} else {
    Fail '同目录下没有 app.jar。请用 scripts\standalone\package.ps1 生成完整交付包'
}

if (Test-Path 'web/index.html') {
    Pass 'web/ 前端静态文件'
} else {
    # 只警告不阻断：接口仍可用，Swagger 也在。但浏览器打开会是一片空白，
    # 而空白页最容易被当成「后端没起来」，所以这句话必须说清是哪一半缺了
    Warn 'web/index.html 不存在：接口可用，但浏览器打开会是空白页（前端未打包进来）'
}

# --- .env ---------------------------------------------------------------------
if (-not (Test-Path '.env')) {
    Fail '没有 .env。先 Copy-Item .env.example .env，再按里面的说明填两个账号口令哈希'
} else {
    <#
    读 .env 灌进当前进程的环境变量。

    这里不做任何变量插值——与 docker compose 相反。compose 会把 .env 里的 $xxx 当变量
    展开，而 BCrypt 哈希里恰好含 $，于是产出「前缀完好、中间少一段」的残缺哈希：
    应用能正常启动，登录永远失败，日志里没有任何线索指向 .env。
    改用这条路之后那个坑自然消失，但值得记下来——它曾经很难查。
    #>
    Get-Content '.env' -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { return }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        # 去掉包裹引号。含 $ 的哈希常被人加引号，带着引号进环境变量会让正则校验失败
        if ($val.Length -ge 2 -and (($val.StartsWith('"') -and $val.EndsWith('"')) -or
                                    ($val.StartsWith("'") -and $val.EndsWith("'")))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $val, 'Process')
    }
    Pass '.env 已载入当前进程'
}

# --- 账号口令哈希（规则 SEC5）-------------------------------------------------
# 与后端 SharedAccountCredentialsCheck 的正则逐字一致：算法版本 + 代价因子 + 22 位盐
# + 31 位摘要，共 53 个 base64 字符。只查 {bcrypt}$2 前缀不够——残缺哈希也能过前缀。
$bcryptPattern = '^\{bcrypt\}\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$'
foreach ($pair in @(
        @{ Name = 'OPERATOR_PASSWORD_HASH'; Label = '运营账号' },
        @{ Name = 'VIEWER_PASSWORD_HASH';   Label = '用户账号' })) {
    $value = [Environment]::GetEnvironmentVariable($pair.Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        Fail "$($pair.Label)口令未配置（$($pair.Name)）。用 .\hash.ps1 '你的口令' 生成哈希后填进 .env"
    } elseif ($value -notmatch $bcryptPattern) {
        Fail "$($pair.Label)口令哈希格式不对（$($pair.Name)）。必须是完整的 {bcrypt}`$2a`$10`$… 共 53 位摘要；后端启动时也会拒绝"
    } else {
        Pass "$($pair.Label)口令哈希格式正确"
    }
}

# --- 端口 ---------------------------------------------------------------------
foreach ($pair in @(
        @{ Port = $Port;   Label = '服务端口';   Hint = '用 -Port 换一个' },
        @{ Port = $DbPort; Label = '内嵌库端口'; Hint = '用 -DbPort 换一个' })) {
    $busy = Get-NetTCPConnection -LocalPort $pair.Port -State Listen -ErrorAction SilentlyContinue
    if (-not $busy) {
        Pass "$($pair.Label) $($pair.Port) 空闲"
        continue
    }

    $ownerPid = $busy[0].OwningProcess
    $owner = (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue).ProcessName

    <#
    占着内嵌库端口的如果是 postgres 进程，那几乎一定是上一次的残留：
    应用被强杀（任务管理器结束进程、掉电）时 JVM 的 shutdown hook 不执行，
    postmaster 就活了下来，同时锁着 data\pgdata。

    这种情况下「用 -DbPort 换一个」是<b>错的建议</b>：换端口照样起不来，
    因为 PostgreSQL 发现数据目录已被另一个 postmaster 锁住会直接拒绝启动，
    而那条报错（lock file already exists）看上去与端口毫无关系。
    所以这里给的是「把残留进程结束掉」，并把 PID 直接报出来。
    #>
    if ($pair.Port -eq $DbPort -and $owner -match 'postgres') {
        Fail ("内嵌库端口 $($pair.Port) 上有一个残留的 postgres 进程（PID $ownerPid）。" +
              "这是上次异常退出留下的，它还锁着 data\pgdata，换端口没用。" +
              "先结束它：Stop-Process -Id $ownerPid -Force")
    } else {
        Fail "$($pair.Label) $($pair.Port) 已被占用（进程 $owner，PID $ownerPid）。$($pair.Hint)"
    }
}

Write-Host '----------------------------------------'
if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host "检查未通过（$($failures.Count) 项），未启动：" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "  · $_" -ForegroundColor Red }
    Write-Host ''
    exit 1
}
Write-Host '检查通过' -ForegroundColor Green
Write-Host ''

# --- 启动 ---------------------------------------------------------------------
# prod 与 standalone 两个 profile 必须一起给：standalone 只回答「数据库从哪来」，
# prod 负责生产姿态（含 SharedAccountCredentialsCheck 这道口令自检）。
# 详见 application-standalone.yml 的文件头。
$env:SPRING_PROFILES_ACTIVE = 'prod,standalone'

$dataDir = Join-Path $PSScriptRoot 'data\pgdata'
$firstRun = -not (Test-Path (Join-Path $dataDir 'PG_VERSION'))

Write-Host "服务地址   http://localhost:$Port" -ForegroundColor Cyan
Write-Host "数据目录   $(Join-Path $PSScriptRoot 'data')" -ForegroundColor Cyan
Write-Host "日志       $(Join-Path $PSScriptRoot 'logs\app.log')" -ForegroundColor Cyan
if ($firstRun) {
    Write-Host ''
    Write-Host '首次启动要先建库（initdb + 49 个迁移脚本），约 1～2 分钟，请勿中断。' -ForegroundColor Yellow
    Write-Host '之后每次启动在 20 秒内。' -ForegroundColor Yellow
}
Write-Host ''
Write-Host '按 Ctrl+C 停止。' -ForegroundColor DarkGray
Write-Host ''

# -Xmx 不设上限交给 JVM 按物理内存推断（默认取 1/4）。内网机器 64G 内存下够用，
# 而写死一个值会在换机器后成为瓶颈或浪费
& java `
    "-Dserver.port=$Port" `
    "-Daiacademy.embedded-db.port=$DbPort" `
    '-Dfile.encoding=UTF-8' `
    '-jar' 'app.jar'

exit $LASTEXITCODE
