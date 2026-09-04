#Requires -Version 5.1
<#
.SYNOPSIS
    生成共享账号口令的 BCrypt 哈希，填进 .env（规则 SEC5）。

.DESCRIPTION
    单机交付包里没有 JDK 也没有 Gradle，因此不能用 gradlew :app:printPasswordHash。
    这里直接从 app.jar 里调同一个工具类，用的是 Spring Boot 的 PropertiesLauncher——
    fat jar 的依赖都在 BOOT-INF/lib 下，普通 -cp 看不见它们。

.EXAMPLE
    .\hash.ps1
    .\hash.ps1 -Password '换成你自己的口令'
#>
[CmdletBinding()]
param(
    # 明文口令。不传则交互式输入（不回显），避免口令留在 PowerShell 历史记录里
    [string]$Password
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if (-not (Test-Path 'app.jar')) {
    Write-Host '同目录下没有 app.jar' -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($Password)) {
    # 走 -Password 传参会把明文留在 PSReadLine 的历史文件里（默认存在用户目录下，
    # 明文、长期保留）。共享账号模型下口令外泄即全量写权限泄露（需求 AC4），
    # 所以默认这条路不回显、不留痕
    $secure = Read-Host -Prompt '请输入口令（不回显）' -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$output = & java `
    '-Dfile.encoding=UTF-8' `
    "-Dloader.main=com.aiacademy.app.security.PasswordHashTool" `
    '-cp' 'app.jar' `
    'org.springframework.boot.loader.launch.PropertiesLauncher' `
    $Password
if ($LASTEXITCODE -ne 0) {
    Write-Host "生成失败（退出码 $LASTEXITCODE）：" -ForegroundColor Red
    $output | ForEach-Object { Write-Host "  $_" }
    exit 1
}

<#
只取原始哈希那一行。

PasswordHashTool 会打印两种写法，第二行标着「.env 专用（$ 已转义为 $$）」——
那是给 Docker Compose 的：compose 会对 .env 的值做变量插值，所以要预先把 $ 写成 $$，
由 compose 还原。

单机模式没有 compose。start.ps1 读 .env 时原样取值、不做插值，因此照抄那一行会把
$$ 真的传给 JVM，得到一个必然登录失败的哈希。这里直接把它滤掉，不让人有机会选错。

判据用的正则与 start.ps1、后端 SharedAccountCredentialsCheck 三处一致：
53 位摘要。转义后的那行含 $$，长度与字符集都对不上，天然被排除。
#>
$bcryptPattern = '^\{bcrypt\}\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$'
$hash = $output | Where-Object { $_.Trim() -match $bcryptPattern } | Select-Object -First 1

if (-not $hash) {
    Write-Host '没能从输出里认出合法的 BCrypt 哈希，原始输出如下：' -ForegroundColor Red
    $output | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Write-Host ''
Write-Host '把下面这一行填进 .env（两个账号各生成一次，不要用同一个口令）：' -ForegroundColor Cyan
Write-Host ''
Write-Host "  $($hash.Trim())" -ForegroundColor Green
Write-Host ''
Write-Host '直接粘贴，不要加引号、不要把 $ 转义成 $$。' -ForegroundColor Yellow
Write-Host '（$$ 那种写法只用于 Docker Compose，单机模式用不上，上面已经滤掉了。）' -ForegroundColor DarkGray
Write-Host ''
