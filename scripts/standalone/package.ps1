#Requires -Version 5.1
<#
.SYNOPSIS
    在联网的开发机上打出单机交付包，拷到内网即可运行（不需要 Docker、Gradle、Node、JDK 之外的任何东西）。

.DESCRIPTION
    产物 dist-standalone/ 的内容：

        app.jar          后端 + 嵌入式 PostgreSQL 15 二进制（约 100 MB）
        web/             前端构建产物，由 app.jar 同源托管
        start.ps1        启动脚本
        hash.ps1         生成口令 BCrypt 哈希
        .env.example     需要填的两处口令哈希
        README.txt       内网运维照着做的三步

    交付包里刻意不含 .env——口令哈希不进版本库、不进交付包，只在目标机上生成（SEC5）。

.EXAMPLE
    .\package.ps1
    .\package.ps1 -SkipFrontend      # 只重打后端
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    # 默认输出到仓库根的 dist-standalone/（已在 .gitignore 里）
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not $OutDir) { $OutDir = Join-Path $repoRoot 'dist-standalone' }

function 步骤($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 后端
if (-not $SkipBackend) {
    步骤 '打包后端（含嵌入式 PostgreSQL 二进制）'
    Push-Location (Join-Path $repoRoot 'backend')
    try {
        & .\gradlew.bat :app:bootJar
        if ($LASTEXITCODE -ne 0) { throw "bootJar 失败（退出码 $LASTEXITCODE）" }
    } finally { Pop-Location }
}

# buildDir 被 settings 改到了用户目录（避免中文路径下的 Gradle 问题），
# 所以这里搜而不是拼死路径
$jar = Get-ChildItem -Path (Join-Path $env:USERPROFILE '.ai-academy-build') `
    -Recurse -Filter 'ai-academy-app.jar' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $jar) { throw '找不到 ai-academy-app.jar，先不要加 -SkipBackend' }

# ---------------------------------------------------------------- 前端
if (-not $SkipFrontend) {
    步骤 '构建前端（tsc --noEmit + vite build）'
    Push-Location (Join-Path $repoRoot 'frontend')
    try {
        if (-not (Test-Path 'node_modules')) {
            Write-Host 'node_modules 不存在，先跑 npm ci' -ForegroundColor Yellow
            & npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci 失败（退出码 $LASTEXITCODE）" }
        }
        <#
            构建前清空 dist。实测一台开发机的 dist 里堆着 12 份 antd-*.js（每份 1.09MB，
            时间戳从 08-10 到 09-04）与 8 份 index-*.js，而 index.html 只引用其中一份 ——
            带哈希的文件名每次构建都换，旧产物就一直留着。交付包因此从 48MB 涨到 88MB，
            多出来的全是永远不会被加载的死代码。

            更要紧的是它破坏了「换台机器打出来的包应当一致」：全新克隆没有 dist，
            打出来是干净的；在长期开发机上打出来则夹带几个月的残渣。
            交付物的内容不该取决于这台机器以前构建过几次。
        #>
        if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "前端构建失败（退出码 $LASTEXITCODE）" }
    } finally { Pop-Location }
}

$dist = Join-Path $repoRoot 'frontend\dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw "$dist 里没有 index.html，先不要加 -SkipFrontend"
}

# ---------------------------------------------------------------- 组装
步骤 "组装交付包 → $OutDir"

<#
输出目录里可能正跑着上一次打的包。

那种情况下 Remove-Item 会在 data\pgdata\epg-lock 上抛 IOException
（「另一个程序正在使用此文件」）。那条报错不提是哪个进程、也不提该先停服务，
只会让人以为交付包坏了，然后去重跑构建——而构建本来是好的。

不预先按 postmaster.pid 判断：那个文件里的 PID 可能已经死了，而句柄是<b>JVM</b>
持着的（嵌入式实例由应用进程内启动）。实测过一次「pid 文件里的进程已不存在、
epg-lock 仍锁着」。所以直接以删除本身为判据，顺带把还占着目录的进程找出来。
#>
if (Test-Path $OutDir) {
    try {
        Remove-Item $OutDir -Recurse -Force -ErrorAction Stop
    } catch {
        # 交付包里的 app.jar 与内嵌库都由同一个 java 进程持有，据此定位比解析 pid 文件可靠
        $holders = Get-Process java -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -and $_.StartInfo } |
            ForEach-Object { "PID $($_.Id)" }
        $hint = if ($holders) { "疑似占用者：$($holders -join '、')。" } else { '' }
        throw ("清不掉 $OutDir —— 里面很可能正跑着上一次打的包。" +
               "先在 start.ps1 的窗口里按 Ctrl+C 停掉服务，再重新打包；" +
               "或者用 -OutDir 输出到另一个目录。$hint" +
               "原始错误：$($_.Exception.Message)")
    }
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

Copy-Item $jar.FullName (Join-Path $OutDir 'app.jar')
Copy-Item $dist (Join-Path $OutDir 'web') -Recurse
Copy-Item (Join-Path $PSScriptRoot 'start.ps1') $OutDir
Copy-Item (Join-Path $PSScriptRoot 'hash.ps1')  $OutDir
Copy-Item (Join-Path $PSScriptRoot '.env.example') $OutDir
Copy-Item (Join-Path $PSScriptRoot 'README.txt')   $OutDir

$size = (Get-ChildItem $OutDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ''
Write-Host ("交付包已就绪：{0}  （{1:N0} MB）" -f $OutDir, ($size / 1MB)) -ForegroundColor Green
Write-Host ''
Write-Host '内网侧三步：' -ForegroundColor Cyan
Write-Host '  1. 装 JRE 17（或 JDK 17），确认 java -version 能跑'
Write-Host '  2. copy .env.example .env，然后 .\hash.ps1 生成两个口令哈希填进去'
Write-Host '  3. .\start.ps1'
Write-Host ''
