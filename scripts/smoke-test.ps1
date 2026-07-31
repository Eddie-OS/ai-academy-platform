# 阶段出口冒烟测试：按《开发实施文档》8.4 的 E0-1～E0-5 逐条走一遍真实 HTTP 请求。
#
# 前置：docker compose -f docker-compose.local.yml up -d 已起库，后端已在 8080 端口运行。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
#
# 每个阶段验收都跑这个脚本；新增出口准则时在末尾追加 Assert 段落，不要另起脚本。

$ErrorActionPreference = 'Stop'

# 默认打本地开发环境（后端直连 8080，口令是 application-local.yml 里的 {noop} 明文）。
# 打生产栈时目标改成 http://localhost（走 Nginx），口令用 .env 里那两个哈希对应的原文：
#   $env:SMOKE_BASE_URL='http://localhost'
#   $env:SMOKE_OPERATOR_PASSWORD='...'; $env:SMOKE_VIEWER_PASSWORD='...'
$base = if ($env:SMOKE_BASE_URL) { $env:SMOKE_BASE_URL } else { 'http://localhost:8080' }
$operatorPassword = if ($env:SMOKE_OPERATOR_PASSWORD) { $env:SMOKE_OPERATOR_PASSWORD } else { 'operator123' }
$viewerPassword = if ($env:SMOKE_VIEWER_PASSWORD) { $env:SMOKE_VIEWER_PASSWORD } else { 'viewer123' }

$script:pass = 0
$script:fail = 0

function Assert($name, $condition, $detail) {
    if ($condition) {
        Write-Host "  PASS  $name" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  FAIL  $name -- $detail" -ForegroundColor Red
        $script:fail++
    }
}

# CookieContainer 会话。CSRF 用 CookieCsrfTokenRepository，因此必须先发一个 GET 拿到
# XSRF-TOKEN Cookie，再在写请求上回传 X-XSRF-TOKEN 头。
function New-Session {
    New-Object Microsoft.PowerShell.Commands.WebRequestSession
}

# Actuator 的 Content-Type 是 application/vnd.spring-boot.actuator.v3+json，
# Windows PowerShell 5.1 不认这个类型，会把响应体当二进制返回 byte[]。
function ConvertTo-Text($content) {
    if ($content -is [byte[]]) { return [System.Text.Encoding]::UTF8.GetString($content) }
    return $content
}

function Invoke-Api($session, $method, $path, $body) {
    $uri = "$base$path"
    $headers = @{}
    $token = $session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }
    if ($token) { $headers['X-XSRF-TOKEN'] = $token.Value }

    $params = @{
        Uri             = $uri
        Method          = $method
        WebSession      = $session
        Headers         = $headers
        UseBasicParsing = $true
        TimeoutSec      = 20
    }
    if ($body) {
        $params['Body'] = ($body | ConvertTo-Json -Compress)
        $params['ContentType'] = 'application/json; charset=utf-8'
    }

    try {
        $response = Invoke-WebRequest @params
        return @{
            Status  = [int]$response.StatusCode
            Body    = (ConvertTo-Text $response.Content | ConvertFrom-Json)
            TraceId = $response.Headers['X-Trace-Id']
        }
    } catch [System.Net.WebException] {
        # 4xx/5xx 时 Invoke-WebRequest 已把响应流读空，响应体只在 ErrorDetails 里，
        # 因此优先取它，取不到再退回读流。
        $raw = $_.ErrorDetails.Message
        $resp = $_.Exception.Response
        if (-not $raw -and $resp) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $raw = $reader.ReadToEnd()
        }
        return @{
            Status  = if ($resp) { [int]$resp.StatusCode } else { -1 }
            Body    = if ($raw) { $raw | ConvertFrom-Json } else { $null }
            TraceId = $null
        }
    }
}

function Login($username, $password) {
    $session = New-Session
    Invoke-Api $session 'GET' '/api/auth/current' $null | Out-Null
    $result = Invoke-Api $session 'POST' '/api/auth/login' @{ username = $username; password = $password }
    return @{ Session = $session; Result = $result }
}

Write-Host ''
Write-Host "冒烟测试目标：$base" -ForegroundColor Cyan

Write-Host ''
Write-Host 'E0-1  后端启动、数据库连通、Flyway 迁移已应用' -ForegroundColor Cyan
$health = Invoke-Api (New-Session) 'GET' '/actuator/health' $null
Assert 'actuator/health 返回 UP' ($health.Body.status -eq 'UP') "status=$($health.Body.status)"

Write-Host ''
Write-Host 'E0-2  两个共享账号登录 + 权限拦截生效' -ForegroundColor Cyan
$anon = Invoke-Api (New-Session) 'GET' '/api/skeleton-samples' $null
Assert '未登录访问业务接口返回 401 UNAUTHENTICATED' `
    ($anon.Status -eq 401 -and $anon.Body.code -eq 'UNAUTHENTICATED') `
    "status=$($anon.Status) code=$($anon.Body.code)"

$badLogin = Login 'operator' 'wrong-password'
Assert '错误口令登录被拒绝' ($badLogin.Result.Status -ge 400) "status=$($badLogin.Result.Status)"

$operator = Login 'operator' $operatorPassword
Assert '运营账号登录成功且返回账号类型 OPERATOR' `
    ($operator.Result.Status -eq 200 -and $operator.Result.Body.data.accountType -eq 'OPERATOR') `
    "status=$($operator.Result.Status) data=$($operator.Result.Body.data | ConvertTo-Json -Compress)"

$viewer = Login 'viewer' $viewerPassword
Assert '查看账号登录成功且返回账号类型 VIEWER' `
    ($viewer.Result.Status -eq 200 -and $viewer.Result.Body.data.accountType -eq 'VIEWER') `
    "status=$($viewer.Result.Status) data=$($viewer.Result.Body.data | ConvertTo-Json -Compress)"

$operatorWrite = Invoke-Api $operator.Session 'POST' '/api/skeleton-samples' @{ sampleName = '冒烟测试样本' }
Assert '运营账号写入成功' ($operatorWrite.Status -eq 200 -and $operatorWrite.Body.code -eq 'OK') `
    "status=$($operatorWrite.Status) body=$($operatorWrite.Body | ConvertTo-Json -Compress)"

$viewerWrite = Invoke-Api $viewer.Session 'POST' '/api/skeleton-samples' @{ sampleName = '不该写进去' }
Assert '查看账号写入被拦截，返回 403 FORBIDDEN' `
    ($viewerWrite.Status -eq 403 -and $viewerWrite.Body.code -eq 'FORBIDDEN') `
    "status=$($viewerWrite.Status) code=$($viewerWrite.Body.code)"

$viewerRead = Invoke-Api $viewer.Session 'GET' '/api/skeleton-samples' $null
Assert '查看账号读取不受限（PMI-2 读权限无差异）' `
    ($viewerRead.Status -eq 200 -and $null -ne $viewerRead.Body.data) `
    "status=$($viewerRead.Status)"

Write-Host ''
Write-Host 'E0-4  统一响应格式与 traceId 透传' -ForegroundColor Cyan
$page = Invoke-Api $operator.Session 'GET' '/api/skeleton-samples' $null
$hasEnvelope = ($null -ne $page.Body.code) -and ($page.Body.PSObject.Properties.Name -contains 'message') `
    -and ($page.Body.PSObject.Properties.Name -contains 'data') `
    -and ($page.Body.PSObject.Properties.Name -contains 'traceId')
Assert '响应体含 code/message/data/traceId 四个字段' $hasEnvelope `
    "keys=$($page.Body.PSObject.Properties.Name -join ',')"
Assert '响应头回传 X-Trace-Id 且与响应体 traceId 一致' `
    ($page.TraceId -and $page.Body.traceId -eq $page.TraceId) `
    "header=$($page.TraceId) body=$($page.Body.traceId)"

$notFound = Invoke-Api $operator.Session 'GET' '/api/skeleton-samples/state-counts' $null
Assert '自定义 SQL（state-counts）可用，MyBatis XML 映射生效' `
    ($notFound.Status -eq 200 -and $notFound.Body.code -eq 'OK') `
    "status=$($notFound.Status)"

$badRequest = Invoke-Api $operator.Session 'POST' '/api/skeleton-samples' @{ sampleName = '' }
Assert '参数校验失败返回 PARAM_INVALID' `
    ($badRequest.Status -eq 400 -and $badRequest.Body.code -eq 'PARAM_INVALID') `
    "status=$($badRequest.Status) code=$($badRequest.Body.code)"
Assert '校验失败的 message 是可直接展示的中文而非堆栈' `
    ($badRequest.Body.message -and $badRequest.Body.message -notmatch 'Exception|at com\.') `
    "message=$($badRequest.Body.message)"

Write-Host ''
Write-Host ("通过 {0} 项，失败 {1} 项" -f $script:pass, $script:fail) -ForegroundColor Cyan
Write-Host ''
if ($script:fail -gt 0) { exit 1 }
