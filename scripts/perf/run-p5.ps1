# =============================================================================
# 阶段 5　P5 性能测试：200MB 分片上传 + 断点续传 + 上传期间看板不受干扰
#
# 需求 16.1.1 P5「附件上传（200MB）支持断点续传或分片上传」，
# 开发 10.6 追加一条：上传进行中打开总看板，首屏仍需 ≤3 秒（P2 的阈值不因上传放宽）。
#
# 三件事必须同时成立，缺一件这条就不算过：
#   1. 200MB 走 40 个 5MB 分片传完并合并成功（含 F2 文件头校验）
#   2. 传一半查 GET /api/attachments/uploads/{id}，已传分片序号能报出来（断点续传的依据）
#   3. 上传进行中并发打总看板，max ≤3000ms
#
# 「并发」是真并发：分片上传放在 Start-Job 的独立进程里，主进程同时打看板。
# 串行地「传一片、测一次」测不出磁盘 IO 与连接池的相互挤占，那正是这条要防的东西。
#
# 用法：powershell -ExecutionPolicy Bypass -File scripts\perf\run-p5.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$base = if ($env:PERF_BASE_URL) { $env:PERF_BASE_URL } else { 'http://localhost:8080' }
$operatorPassword = if ($env:SMOKE_OPERATOR_PASSWORD) { $env:SMOKE_OPERATOR_PASSWORD } else { 'operator123' }

$fileSize = 200 * 1024 * 1024
$chunkSize = 5 * 1024 * 1024
$fileName = 'perf-courseware.zip'

function New-Session { New-Object Microsoft.PowerShell.Commands.WebRequestSession }

function Get-CsrfHeaders($session) {
    $headers = @{}
    $token = $session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }
    if ($token) { $headers['X-XSRF-TOKEN'] = $token.Value }
    return $headers
}

function Read-Text($response) {
    $content = $response.Content
    if ($content -is [byte[]]) { return [System.Text.Encoding]::UTF8.GetString($content) }
    return [string]$content
}

function Login-Operator {
    $session = New-Session
    $null = Invoke-WebRequest -Uri "$base/api/auth/current" -WebSession $session -UseBasicParsing
    $body = @{ username = 'operator'; password = $operatorPassword } | ConvertTo-Json
    $null = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body $body `
        -ContentType 'application/json; charset=utf-8' -Headers (Get-CsrfHeaders $session) `
        -WebSession $session -UseBasicParsing
    return $session
}

# PowerShell 5.1 的 Invoke-WebRequest 没有 -Form，multipart 只能自己拼字节。
# 用 MemoryStream 而不是 byte[] 相加：`$a + $b` 得到的是 Object[]，会被当字符串序列发出去。
function Send-Chunk($session, $uploadId, $index, $bytes) {
    $boundary = [System.Guid]::NewGuid().ToString()
    $encoding = [System.Text.Encoding]::UTF8
    $head = "--$boundary`r`n" +
            "Content-Disposition: form-data; name=`"file`"; filename=`"chunk-$index`"`r`n" +
            "Content-Type: application/octet-stream`r`n`r`n"
    $headBytes = $encoding.GetBytes($head)
    $tailBytes = $encoding.GetBytes("`r`n--$boundary--`r`n")

    $stream = New-Object System.IO.MemoryStream
    $stream.Write($headBytes, 0, $headBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Write($tailBytes, 0, $tailBytes.Length)

    $response = Invoke-WebRequest -Uri "$base/api/attachments/uploads/$uploadId/chunks/$index" `
        -Method PUT -WebSession $session -Headers (Get-CsrfHeaders $session) -UseBasicParsing `
        -ContentType "multipart/form-data; boundary=$boundary" -Body $stream.ToArray() -TimeoutSec 120
    $stream.Dispose()
    return [int]$response.StatusCode
}

Write-Host "===== P5　200MB 分片上传（$base）====="

# ---------------------------------------------------------------------------
# 造 200MB 源文件。前 4 字节写 ZIP 签名 PK\3\4：合并后要过 F2 文件头校验，
# 全零文件的家族是 UNKNOWN，会被正确地拒掉
# ---------------------------------------------------------------------------
$tmpFile = Join-Path $env:TEMP 'perf-courseware.zip'
if (-not (Test-Path $tmpFile) -or (Get-Item $tmpFile).Length -ne $fileSize) {
    Write-Host "造 200MB 源文件 $tmpFile ..."
    $fs = [System.IO.File]::Create($tmpFile)
    try {
        $fs.Write([byte[]](0x50, 0x4B, 0x03, 0x04), 0, 4)
        $block = New-Object byte[] (1024 * 1024)
        (New-Object System.Random 42).NextBytes($block)
        $written = 4
        while ($written -lt $fileSize) {
            $take = [Math]::Min($block.Length, $fileSize - $written)
            $fs.Write($block, 0, $take)
            $written += $take
        }
    } finally { $fs.Dispose() }
}
Write-Host ("源文件 {0:N0} 字节" -f (Get-Item $tmpFile).Length)

$session = Login-Operator

# 1. 申请上传
$initBody = @{ fileName = $fileName; fileSize = $fileSize; scene = 'COURSEWARE'; ownerType = 'COURSE' } | ConvertTo-Json
$initResp = Invoke-WebRequest -Uri "$base/api/attachments/uploads" -Method POST -Body $initBody `
    -ContentType 'application/json; charset=utf-8' -Headers (Get-CsrfHeaders $session) `
    -WebSession $session -UseBasicParsing
$ticket = ((Read-Text $initResp) | ConvertFrom-Json).data
$uploadId = $ticket.uploadId
$totalChunks = $ticket.totalChunks
Write-Host "uploadId=$uploadId 分片 $totalChunks × $($ticket.chunkSize) 字节"

# ---------------------------------------------------------------------------
# 2. 先传 3 片就停下，模拟中断，再查已传分片 —— 这是断点续传的证据
# ---------------------------------------------------------------------------
$reader = [System.IO.File]::OpenRead($tmpFile)
try {
    for ($i = 0; $i -lt 3; $i++) {
        $buffer = New-Object byte[] $chunkSize
        $read = $reader.Read($buffer, 0, $chunkSize)
        if ($read -lt $chunkSize) { [Array]::Resize([ref]$buffer, $read) }
        $null = Send-Chunk $session $uploadId $i $buffer
    }
} finally { $reader.Dispose() }

$statusResp = Invoke-WebRequest -Uri "$base/api/attachments/uploads/$uploadId" -WebSession $session -UseBasicParsing
$statusTicket = ((Read-Text $statusResp) | ConvertFrom-Json).data
$uploaded = @($statusTicket.uploadedChunks)
$resumeOk = ($uploaded.Count -eq 3)
Write-Host ("中断后已传分片：[{0}]　断点续传可用={1}" -f ($uploaded -join ','), $resumeOk)

# ---------------------------------------------------------------------------
# 3. 剩余分片放到独立进程里传，主进程同时打总看板
# ---------------------------------------------------------------------------
$job = Start-Job -ScriptBlock {
    param($base, $password, $uploadId, $tmpFile, $chunkSize, $startIndex, $totalChunks)

    function Get-CsrfHeaders($session, $base) {
        $headers = @{}
        $token = $session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }
        if ($token) { $headers['X-XSRF-TOKEN'] = $token.Value }
        return $headers
    }

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $null = Invoke-WebRequest -Uri "$base/api/auth/current" -WebSession $session -UseBasicParsing
    $null = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST `
        -Body (@{ username = 'operator'; password = $password } | ConvertTo-Json) `
        -ContentType 'application/json; charset=utf-8' -Headers (Get-CsrfHeaders $session $base) `
        -WebSession $session -UseBasicParsing

    $reader = [System.IO.File]::OpenRead($tmpFile)
    $reader.Seek([long]$startIndex * $chunkSize, 'Begin') | Out-Null
    try {
        for ($i = $startIndex; $i -lt $totalChunks; $i++) {
            $buffer = New-Object byte[] $chunkSize
            $read = $reader.Read($buffer, 0, $chunkSize)
            if ($read -le 0) { break }
            if ($read -lt $chunkSize) { [Array]::Resize([ref]$buffer, $read) }

            $boundary = [System.Guid]::NewGuid().ToString()
            $encoding = [System.Text.Encoding]::UTF8
            $head = "--$boundary`r`n" +
                    "Content-Disposition: form-data; name=`"file`"; filename=`"chunk-$i`"`r`n" +
                    "Content-Type: application/octet-stream`r`n`r`n"
            $headBytes = $encoding.GetBytes($head)
            $tailBytes = $encoding.GetBytes("`r`n--$boundary--`r`n")
            $stream = New-Object System.IO.MemoryStream
            $stream.Write($headBytes, 0, $headBytes.Length)
            $stream.Write($buffer, 0, $buffer.Length)
            $stream.Write($tailBytes, 0, $tailBytes.Length)

            $null = Invoke-WebRequest -Uri "$base/api/attachments/uploads/$uploadId/chunks/$i" `
                -Method PUT -WebSession $session -Headers (Get-CsrfHeaders $session $base) -UseBasicParsing `
                -ContentType "multipart/form-data; boundary=$boundary" -Body $stream.ToArray() -TimeoutSec 120
            $stream.Dispose()
        }
    } finally { $reader.Dispose() }
    return 'upload-done'
} -ArgumentList $base, $operatorPassword, $uploadId, $tmpFile, $chunkSize, 3, $totalChunks

$uploadSw = [System.Diagnostics.Stopwatch]::StartNew()
$dashboardTimes = @()
while ($job.State -eq 'Running' -or $job.State -eq 'NotStarted') {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri "$base/api/dashboard/overview" -WebSession $session -UseBasicParsing -TimeoutSec 30
        $sw.Stop()
        if ($resp.StatusCode -eq 200) { $dashboardTimes += $sw.Elapsed.TotalMilliseconds }
    } catch {
        $sw.Stop()
        Write-Host "看板请求失败：$($_.Exception.Message)" -ForegroundColor Yellow
    }
    Start-Sleep -Milliseconds 300
}
$uploadSw.Stop()
$jobResult = Receive-Job $job
Remove-Job $job -Force
Write-Host "分片上传子进程结束：$jobResult"

# 4. 合并（含 F2 文件头校验）
$mergeSw = [System.Diagnostics.Stopwatch]::StartNew()
$completeResp = Invoke-WebRequest -Uri "$base/api/attachments/uploads/$uploadId/completion" -Method POST `
    -WebSession $session -Headers (Get-CsrfHeaders $session) -UseBasicParsing -TimeoutSec 300
$mergeSw.Stop()
$attachment = ((Read-Text $completeResp) | ConvertFrom-Json).data
$sizeOk = ([long]$attachment.fileSize -eq $fileSize)

$dashMax = 0
$dashAvg = 0
if ($dashboardTimes.Count -gt 0) {
    $dashMax = [math]::Round(($dashboardTimes | Measure-Object -Maximum).Maximum, 1)
    $dashAvg = [math]::Round(($dashboardTimes | Measure-Object -Average).Average, 1)
}
$dashOk = ($dashMax -le 3000 -and $dashboardTimes.Count -gt 0)

Write-Host ''
Write-Host ("上传耗时（并发段）　{0}s" -f [math]::Round($uploadSw.Elapsed.TotalSeconds, 1))
Write-Host ("合并耗时　　　　　　{0}s　附件 id={1} 落库大小={2:N0} 字节 一致={3}" -f `
    [math]::Round($mergeSw.Elapsed.TotalSeconds, 1), $attachment.id, [long]$attachment.fileSize, $sizeOk)
Write-Host ("上传期间总看板　　　{0} 次采样 avg={1}ms max={2}ms 限 3000ms" -f $dashboardTimes.Count, $dashAvg, $dashMax)
Write-Host ''
Write-Host ("断点续传　{0}" -f $(if ($resumeOk) { 'PASS' } else { 'FAIL' }))
Write-Host ("200MB 合并　{0}" -f $(if ($sizeOk) { 'PASS' } else { 'FAIL' }))
Write-Host ("看板不受干扰　{0}" -f $(if ($dashOk) { 'PASS' } else { 'FAIL' }))

if ($resumeOk -and $sizeOk -and $dashOk) {
    Write-Host 'P5 PASS' -ForegroundColor Green
    exit 0
}
Write-Host 'P5 FAIL' -ForegroundColor Red
exit 1
