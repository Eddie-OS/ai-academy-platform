# =============================================================================
# 阶段 5　P1～P6 性能测试（无新依赖：PowerShell + Invoke-WebRequest）
#
# 前置：
#   1. 后端已启动（默认 http://localhost:8080）
#   2. 已执行 seed.ps1 + seed-perf.ps1
#   3. 运营账号可登录
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\perf\run-p1-p6.ps1
#   $env:PERF_BASE_URL='http://localhost:8080'
#
# P4 走后端 ImportPerformanceTest（gradle）；P5 需真机人工填结果。
# 结果摘要打印到控制台，并写入 docs/阶段5-性能测试报告.md 的「最近一次自动跑」段。
# =============================================================================

$ErrorActionPreference = 'Stop'
$base = if ($env:PERF_BASE_URL) { $env:PERF_BASE_URL } else { 'http://localhost:8080' }
# 无默认值：仓库里不留口令字面量。本地填 .env 里的 LOCAL_OPERATOR_PASSWORD。
if (-not $env:SMOKE_OPERATOR_PASSWORD) { throw '请先设置 SMOKE_OPERATOR_PASSWORD（本地即 .env 里的 LOCAL_OPERATOR_PASSWORD）' }
$operatorPassword = $env:SMOKE_OPERATOR_PASSWORD
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function New-Session { New-Object Microsoft.PowerShell.Commands.WebRequestSession }

function Get-CsrfHeaders($session) {
    $headers = @{}
    $token = $session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }
    if ($token) { $headers['X-XSRF-TOKEN'] = $token.Value }
    return $headers
}

function Login-Operator {
    $session = New-Session
    # 先 GET 拿 XSRF-TOKEN Cookie。只能用 /api/auth/current：它未登录也回 200，
    # 而 /api/meta/enums 未登录回 401，Invoke-WebRequest 会直接抛异常（与 smoke-test.ps1 同一套路）
    $null = Invoke-WebRequest -Uri "$base/api/auth/current" -WebSession $session -UseBasicParsing
    $body = @{ username = 'operator'; password = $operatorPassword } | ConvertTo-Json
    $headers = Get-CsrfHeaders $session
    $null = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body $body `
        -ContentType 'application/json; charset=utf-8' -Headers $headers `
        -WebSession $session -UseBasicParsing
    return $session
}

# Invoke-WebRequest 的 Content 对 JSON 响应已是字符串、对二进制才是 byte[]，
# 两种都要能读，否则异步导出那条 JSON 会在 GetString 上炸掉。
function Read-Text($response) {
    $content = $response.Content
    if ($content -is [byte[]]) {
        return [System.Text.Encoding]::UTF8.GetString($content)
    }
    return [string]$content
}

function Measure-GetMs($session, $url, $repeats = 5) {
    $times = @()
    for ($i = 0; $i -lt $repeats; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing
        $sw.Stop()
        if ($resp.StatusCode -ne 200) { throw "GET $url -> $($resp.StatusCode)" }
        $times += $sw.Elapsed.TotalMilliseconds
    }
    return [pscustomobject]@{
        avg = [math]::Round(($times | Measure-Object -Average).Average, 1)
        max = [math]::Round(($times | Measure-Object -Maximum).Maximum, 1)
        min = [math]::Round(($times | Measure-Object -Minimum).Minimum, 1)
    }
}

Write-Host "===== P1～P6 性能（$base）====="
$session = Login-Operator
$results = @()

# P1 列表首屏 ≤2s，5 次取样（开发 10.6：5 并发用串行多次近似；真并发见报告人工栏）
$p1 = Measure-GetMs $session "$base/api/courses?pageNum=1&pageSize=20" 5
$p1Ok = $p1.max -le 2000
$results += [pscustomobject]@{ id='P1'; name='课程列表首屏'; limitMs=2000; avg=$p1.avg; max=$p1.max; ok=$p1Ok }
Write-Host ("P1 列表  avg={0}ms max={1}ms  {2}" -f $p1.avg, $p1.max, $(if ($p1Ok) {'PASS'} else {'FAIL'}))

# P2 总看板 ≤3s
$p2 = Measure-GetMs $session "$base/api/dashboard/overview" 5
$p2Ok = $p2.max -le 3000
$results += [pscustomobject]@{ id='P2'; name='总看板 overview'; limitMs=3000; avg=$p2.avg; max=$p2.max; ok=$p2Ok }
Write-Host ("P2 看板  avg={0}ms max={1}ms  {2}" -f $p2.avg, $p2.max, $(if ($p2Ok) {'PASS'} else {'FAIL'}))

# P3 详情 ≤1.5s —— 取列表第一条
$listBody = (Invoke-WebRequest -Uri "$base/api/courses?pageNum=1&pageSize=1" -WebSession $session -UseBasicParsing).Content
$listJson = $listBody | ConvertFrom-Json
$courseId = $null
if ($listJson.data -and $listJson.data.records -and $listJson.data.records.Count -gt 0) {
    $courseId = $listJson.data.records[0].id
}
if (-not $courseId) {
    Write-Host 'P3 SKIP：无课程数据，先跑 seed-perf.ps1' -ForegroundColor Yellow
    $results += [pscustomobject]@{ id='P3'; name='课程详情'; limitMs=1500; avg=$null; max=$null; ok=$false }
} else {
    $p3 = Measure-GetMs $session "$base/api/courses/$courseId" 5
    $p3Ok = $p3.max -le 1500
    $results += [pscustomobject]@{ id='P3'; name='课程详情'; limitMs=1500; avg=$p3.avg; max=$p3.max; ok=$p3Ok }
    Write-Host ("P3 详情  avg={0}ms max={1}ms  {2}" -f $p3.avg, $p3.max, $(if ($p3Ok) {'PASS'} else {'FAIL'}))
}

# P6 导出（需求 P6：10000 行 ≤30s，或转异步）。
# 计时到「拿到文件」为止，不是到「发起成功」为止——>2000 行会转异步，只测发起等于没测。
$total = ($listJson.data.total)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $headers = Get-CsrfHeaders $session
    $exportResp = Invoke-WebRequest -Uri "$base/api/courses/export" -Method GET `
        -WebSession $session -Headers $headers -UseBasicParsing
    $mode = '同步'
    if ($exportResp.Headers['Content-Type'] -like '*json*') {
        # 异步：{ async: true, taskId }，每秒轮询直到 SUCCESS，再下载
        $mode = '异步'
        $task = ((Read-Text $exportResp) | ConvertFrom-Json).data
        $taskId = $task.taskId
        if (-not $taskId) { $taskId = $task.id }
        # ExportTask 的字段是 status，取值 RUNNING／DONE／FAILED（见 ExportTask）
        $status = ''
        $rowCount = $null
        for ($i = 0; $i -lt 120; $i++) {
            Start-Sleep -Milliseconds 500
            $st = (Invoke-WebRequest -Uri "$base/api/exports/$taskId" -WebSession $session -UseBasicParsing)
            $task = ((Read-Text $st) | ConvertFrom-Json).data
            $status = $task.status
            $rowCount = $task.rowCount
            if ($status -eq 'DONE' -or $status -eq 'FAILED') { break }
        }
        if ($status -ne 'DONE') { throw "导出任务未完成：status=$status" }
        $dl = Invoke-WebRequest -Uri "$base/api/exports/$taskId/download" -WebSession $session -UseBasicParsing
        $bytes = $dl.RawContentLength
    } else {
        $bytes = $exportResp.RawContentLength
        $rowCount = $total
    }
    $sw.Stop()
    $exportMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    $p6Ok = $exportMs -le 30000
    $results += [pscustomobject]@{ id='P6'; name="课程导出($mode，$rowCount 行)"; limitMs=30000; avg=$exportMs; max=$exportMs; ok=$p6Ok }
    Write-Host ("P6 导出  {0} {1} 行  {2}ms  {3}KB  {4}" -f $mode, $rowCount, $exportMs,
        [math]::Round($bytes / 1024, 0), $(if ($p6Ok) {'PASS'} else {'FAIL'}))
} catch {
    $sw.Stop()
    Write-Host "P6 导出请求异常：$($_.Exception.Message)" -ForegroundColor Yellow
    $results += [pscustomobject]@{ id='P6'; name='课程导出'; limitMs=30000; avg=$null; max=$null; ok=$false }
}

Write-Host ''
Write-Host 'P4：请跑  .\gradlew :app:test --tests com.aiacademy.app.dataimport.ImportPerformanceTest'
Write-Host 'P5：真机 200MB 上传 + 同时打开总看板，结果填入 docs/阶段5-性能测试报告.md'

$failCount = @($results | Where-Object { -not $_.ok }).Count
Write-Host ''
Write-Host ("自动项结果：{0} 项，失败 {1}" -f $results.Count, $failCount)
if ($failCount -gt 0) { exit 1 }
exit 0
