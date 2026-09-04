# =============================================================================
# 共用的 SQL 执行器：把一个 .sql 文件喂给数据库，两种形态都支持。
#
# seed.ps1 与 seed-perf.ps1 都 dot-source 这个文件。不要直接执行它。
#
# 【为什么要有这一层】原先两个脚本都写死 docker exec ... psql。内网装不了 Docker、
# 交付形态换成嵌入式 PostgreSQL 之后，那条路断了；而嵌入式实例只解包
# initdb / pg_ctl / postgres，没有 psql。所以两种形态各走一条路：
#
#   Docker 形态  ：docker cp + docker exec psql（保持原样，编码处理是验证过的）
#   单机形态     ：JDBC，驱动从 app.jar 里取，跑 RunSqlFile.java（JEP 330 单文件源码）
#
# 单机形态需要 JDK（javac），不是只要 JRE —— 灌数据是开发/维护动作，在开发机上做，
# 那台机器本来就得有 JDK 才能构建后端。交付到内网的那台只需要 JRE。
# =============================================================================

$script:DockerContainer = 'aiacademy-postgres-local'

function Test-DockerPostgres {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
    # docker 装了但守护进程没起时 docker ps 会报错，别让它变成终止性错误
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $running = docker ps --filter "name=$script:DockerContainer" --format '{{.Names}}' 2>$null
    } finally {
        $ErrorActionPreference = $prev
    }
    return $running -eq $script:DockerContainer
}

<#
    找 PostgreSQL JDBC 驱动。app.jar 是 Spring Boot fat jar，驱动在 BOOT-INF/lib 里，
    不在 jar 根的 classpath 上，所以必须先解出来。
    找不到 app.jar 时报错并说清怎么产生它，而不是含糊地说「缺依赖」。
#>
function Get-JdbcDriver {
    param([string]$RepoRoot)

    $cacheDir = Join-Path $env:TEMP 'aiacademy-sql-runner'
    $driver = Join-Path $cacheDir 'postgresql.jar'
    if (Test-Path $driver) { return $driver }

    $jarCandidates = @(
        (Join-Path $RepoRoot 'dist-standalone\app.jar'),
        (Join-Path $env:USERPROFILE '.ai-academy-build\app\build\libs\ai-academy-app.jar'),
        (Join-Path $RepoRoot 'backend\app\build\libs\ai-academy-app.jar')
    )
    $appJar = $jarCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $appJar) {
        throw @"
找不到 app.jar，无法取出 JDBC 驱动。先构建一次后端：
    powershell -ExecutionPolicy Bypass -File scripts\standalone\package.ps1
找过这些位置：
$($jarCandidates | ForEach-Object { "    $_" } | Out-String)
"@
    }

    New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($appJar)
    try {
        $entry = $zip.Entries | Where-Object { $_.FullName -match 'BOOT-INF/lib/postgresql-.*\.jar$' } | Select-Object -First 1
        if (-not $entry) { throw "$appJar 里没有 postgresql JDBC 驱动" }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $driver, $true)
    } finally {
        $zip.Dispose()
    }
    return $driver
}

<#
    执行一个 SQL 文件。

    -Mode  auto（默认）／docker／standalone。
    -DbPort 只对单机形态有意义，默认 15432（application-standalone.yml 里的值）。

    嵌入式实例的库名与账号固定是 postgres，且 initdb 建的是 trust 认证，没有口令
    ——见 EmbeddedPostgresBootstrap 的类注释。

    【为什么 auto 之外还要能显式指定】开发机上常常两个库同时活着：Docker 容器跑着日常
    开发库，单机实例跑着交付验证库。auto 一律优先 Docker，于是 `-DbPort 15460` 会被
    静默忽略、SQL 打到另一个库上。这不是假想：本脚本改完后第一次验证就这么把 1 万门
    PERF- 课程灌进了日常开发库，而命令行上明明写着别的端口。

    所以 auto 在两个库都在时会打印它选了哪个；给了 -DbPort 却选中 Docker 时直接报错，
    要求把话说清楚。灌数据是破坏性动作，"猜错了但不告诉你" 的代价太高。
#>
function Invoke-SqlFile {
    param(
        [Parameter(Mandatory = $true)][string]$SqlFile,
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [int]$DbPort = 15432,
        [ValidateSet('auto', 'docker', 'standalone')][string]$Mode = 'auto',
        [bool]$DbPortExplicit = $false
    )

    if (-not (Test-Path $SqlFile)) { throw "找不到 $SqlFile" }

    $dockerUp = ($Mode -ne 'standalone') -and (Test-DockerPostgres)

    if ($Mode -eq 'docker' -and -not $dockerUp) {
        throw "指定了 -Mode docker，但容器 $script:DockerContainer 没在运行。先执行：docker compose -f docker-compose.local.yml up -d"
    }
    if ($dockerUp -and $Mode -eq 'auto' -and $DbPortExplicit) {
        throw @"
你传了 -DbPort $DbPort（这是单机形态的参数），但 Docker 容器 $script:DockerContainer 也在运行。
auto 模式下会优先打到 Docker 那个库上，而那大概不是你要的 —— 请把话说清楚：
    -Mode standalone -DbPort $DbPort    往嵌入式实例灌
    -Mode docker                        往 Docker 容器灌
"@
    }

    if ($dockerUp) {
        Write-Host "走 Docker 形态（容器 $script:DockerContainer）" -ForegroundColor DarkGray
        docker cp $SqlFile "${script:DockerContainer}:/tmp/seed-input.sql"
        if ($LASTEXITCODE -ne 0) { throw 'docker cp 失败' }
        # PGCLIENTENCODING 显式声明 UTF8：容器 locale 是 C，不声明的话 psql 会按 SQL_ASCII 解读文件
        docker exec -e PGCLIENTENCODING=UTF8 $script:DockerContainer `
            psql -U aiacademy -d aiacademy -v ON_ERROR_STOP=1 -f /tmp/seed-input.sql
        if ($LASTEXITCODE -ne 0) { throw 'psql 执行失败' }
        return
    }

    $listening = Get-NetTCPConnection -LocalPort $DbPort -State Listen -ErrorAction SilentlyContinue
    if (-not $listening) {
        throw @"
$DbPort 端口上没有数据库在监听（Docker 容器 $script:DockerContainer 也没有可用）。

单机形态：先把应用跑起来（它会拉起嵌入式 PostgreSQL 并跑完 Flyway 迁移），再执行本脚本：
    cd dist-standalone; .\start.ps1
换过端口的话用 -DbPort 传进来。

Docker 形态：docker compose -f docker-compose.local.yml up -d
"@
    }

    if (-not (Get-Command javac -ErrorAction SilentlyContinue)) {
        throw '单机形态下灌数据需要 JDK（javac），当前只找到 JRE 或没有 Java。灌数据是开发机上的动作。'
    }

    Write-Host "走单机形态（嵌入式 PostgreSQL，端口 $DbPort）" -ForegroundColor DarkGray
    $driver = Get-JdbcDriver -RepoRoot $RepoRoot
    $runner = Join-Path $PSScriptRoot 'RunSqlFile.java'
    $url = "jdbc:postgresql://localhost:$DbPort/postgres?user=postgres"

    & java '-Dfile.encoding=UTF-8' '-cp' $driver $runner $url $SqlFile
    if ($LASTEXITCODE -ne 0) { throw "SQL 执行失败（退出码 $LASTEXITCODE）" }
}
