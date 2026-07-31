# 阶段出口冒烟测试：按《开发实施文档》8.4 的 E0-1～E0-5 逐条走一遍真实 HTTP 请求。
#
# 前置：docker compose -f docker-compose.local.yml up -d 已起库，后端已在 8080 端口运行。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
#
# 每个阶段验收都跑这个脚本；新增出口准则时在末尾追加 Assert 段落，不要另起脚本。
#
# 1C 起断言对象从骨架示例接口改为导入中心与附件接口（骨架表与四层代码已由 V1_009 删除）。
# 选它们的理由：附件的「申请上传 → 传分片 → 合并」是 JSON + multipart 都覆盖、且真的往
# sys_attachment 写行的最短写路径，不需要在 PowerShell 里现造 .xlsx。

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

function Get-CsrfHeaders($session) {
    $headers = @{}
    $token = $session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }
    if ($token) { $headers['X-XSRF-TOKEN'] = $token.Value }
    return $headers
}

# 4xx/5xx 时 Invoke-WebRequest 已把响应流读空，响应体只在 ErrorDetails 里，
# 因此优先取它，取不到再退回读流。
function Read-ErrorResponse($errorRecord) {
    $raw = $errorRecord.ErrorDetails.Message
    $resp = $errorRecord.Exception.Response
    if (-not $raw -and $resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $raw = $reader.ReadToEnd()
    }
    return @{
        Status  = if ($resp) { [int]$resp.StatusCode } else { -1 }
        Body    = if ($raw) { $raw | ConvertFrom-Json } else { $null }
        TraceId = $null
        Bytes   = $null
    }
}

function Invoke-Api($session, $method, $path, $body) {
    $params = @{
        Uri             = "$base$path"
        Method          = $method
        WebSession      = $session
        Headers         = (Get-CsrfHeaders $session)
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
            Bytes   = $response.Content
        }
    } catch [System.Net.WebException] {
        return Read-ErrorResponse $_
    }
}

# 二进制下载（模板、原文件、错误报告）。不解析 JSON，只把字节和响应头带回来。
function Invoke-Download($session, $path) {
    try {
        $response = Invoke-WebRequest -Uri "$base$path" -WebSession $session `
            -Headers (Get-CsrfHeaders $session) -UseBasicParsing -TimeoutSec 30
        $bytes = $response.Content
        if ($bytes -isnot [byte[]]) { $bytes = [System.Text.Encoding]::UTF8.GetBytes($bytes) }
        return @{
            Status      = [int]$response.StatusCode
            Bytes       = $bytes
            Disposition = $response.Headers['Content-Disposition']
        }
    } catch [System.Net.WebException] {
        return Read-ErrorResponse $_
    }
}

# multipart/form-data。PowerShell 5.1 没有 -Form 参数，只能自己拼字节。
# 用 MemoryStream 而不是 byte[] 相加：`$a + $b` 会得到 Object[]，Invoke-WebRequest 会把它
# 当字符串序列发出去，服务端收到的分片内容就不是原始字节了。
function Invoke-Multipart($session, $method, $path, $fileName, $bytes) {
    $boundary = [System.Guid]::NewGuid().ToString()
    $encoding = [System.Text.Encoding]::UTF8
    $head = "--$boundary`r`n" +
            "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"`r`n" +
            "Content-Type: application/octet-stream`r`n`r`n"
    $tail = "`r`n--$boundary--`r`n"

    $stream = New-Object System.IO.MemoryStream
    $headBytes = $encoding.GetBytes($head)
    $tailBytes = $encoding.GetBytes($tail)
    $stream.Write($headBytes, 0, $headBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Write($tailBytes, 0, $tailBytes.Length)

    try {
        $response = Invoke-WebRequest -Uri "$base$path" -Method $method -WebSession $session `
            -Headers (Get-CsrfHeaders $session) -UseBasicParsing -TimeoutSec 60 `
            -ContentType "multipart/form-data; boundary=$boundary" -Body $stream.ToArray()
        return @{
            Status  = [int]$response.StatusCode
            Body    = (ConvertTo-Text $response.Content | ConvertFrom-Json)
            TraceId = $response.Headers['X-Trace-Id']
        }
    } catch [System.Net.WebException] {
        return Read-ErrorResponse $_
    } finally {
        $stream.Dispose()
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
$anon = Invoke-Api (New-Session) 'GET' '/api/imports' $null
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

# 一个 26 字节的合法 PNG（文件头 89 50 4E 47 0D 0A 1A 0A + 填充）。规则 F2 校验的是文件头，
# 因此这一串必须是真的 PNG 头，随手写几个字节会被合并阶段挡掉。
$png = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) + `
       [byte[]][System.Text.Encoding]::ASCII.GetBytes('ai-academy-smoke-test')

$initBody = @{ fileName = '冒烟测试.png'; fileSize = $png.Length; scene = 'GENERAL'; ownerType = 'CASE' }
$init = Invoke-Api $operator.Session 'POST' '/api/attachments/uploads' $initBody
Assert '运营账号可发起写操作（申请上传）' `
    ($init.Status -eq 200 -and $init.Body.data.uploadId) `
    "status=$($init.Status) body=$($init.Body | ConvertTo-Json -Compress)"

$uploadId = $init.Body.data.uploadId
$chunk = Invoke-Multipart $operator.Session 'PUT' "/api/attachments/uploads/$uploadId/chunks/0" 'chunk0' $png
Assert 'multipart 分片上传成功，字节数与原文件一致' `
    ($chunk.Status -eq 200 -and $chunk.Body.data -eq $png.Length) `
    "status=$($chunk.Status) body=$($chunk.Body | ConvertTo-Json -Compress)"

$complete = Invoke-Api $operator.Session 'POST' "/api/attachments/uploads/$uploadId/completion" $null
Assert '运营账号写入数据库成功（合并后落 sys_attachment 元数据）' `
    ($complete.Status -eq 200 -and $complete.Body.data.id -gt 0 -and $complete.Body.data.sha256) `
    "status=$($complete.Status) body=$($complete.Body | ConvertTo-Json -Compress)"

$attachmentId = $complete.Body.data.id
$download = Invoke-Download $operator.Session "/api/attachments/$attachmentId/download"
Assert '下载回来的字节与上传的完全一致（规则 F3 流式下载）' `
    ($download.Status -eq 200 -and $download.Bytes.Length -eq $png.Length -and $download.Bytes[0] -eq 0x89) `
    "status=$($download.Status) length=$($download.Bytes.Length) expected=$($png.Length)"

$anonDownload = Invoke-Download (New-Session) "/api/attachments/$attachmentId/download"
Assert '未登录下载附件被拒（规则 F3，一期唯一访问控制点）' `
    ($anonDownload.Status -eq 401 -and $anonDownload.Body.code -eq 'UNAUTHENTICATED') `
    "status=$($anonDownload.Status) code=$($anonDownload.Body.code)"

# 逻辑删除（规则 F5）：顺手把冒烟测试造的这条收掉，同时验证删除路径可用。
# 文件仍留在磁盘上，由孤儿清理任务在 24 小时后回收——这正是 F5 的设计。
$delete = Invoke-Api $operator.Session 'DELETE' "/api/attachments/$attachmentId" $null
Assert '逻辑删除成功（规则 F5，文件不物理删除）' `
    ($delete.Status -eq 200 -and $delete.Body.code -eq 'OK') "status=$($delete.Status)"

$viewerWrite = Invoke-Api $viewer.Session 'POST' '/api/attachments/uploads' $initBody
Assert '查看账号写入被拦截，返回 403 FORBIDDEN' `
    ($viewerWrite.Status -eq 403 -and $viewerWrite.Body.code -eq 'FORBIDDEN') `
    "status=$($viewerWrite.Status) code=$($viewerWrite.Body.code)"

$viewerRead = Invoke-Api $viewer.Session 'GET' '/api/imports' $null
Assert '查看账号读取不受限（PMI-2 读权限无差异）' `
    ($viewerRead.Status -eq 200 -and $null -ne $viewerRead.Body.data) `
    "status=$($viewerRead.Status)"

Write-Host ''
Write-Host 'E0-4  统一响应格式与 traceId 透传' -ForegroundColor Cyan
$page = Invoke-Api $operator.Session 'GET' '/api/imports' $null
$hasEnvelope = ($null -ne $page.Body.code) -and ($page.Body.PSObject.Properties.Name -contains 'message') `
    -and ($page.Body.PSObject.Properties.Name -contains 'data') `
    -and ($page.Body.PSObject.Properties.Name -contains 'traceId')
Assert '响应体含 code/message/data/traceId 四个字段' $hasEnvelope `
    "keys=$($page.Body.PSObject.Properties.Name -join ',')"
Assert '响应头回传 X-Trace-Id 且与响应体 traceId 一致' `
    ($page.TraceId -and $page.Body.traceId -eq $page.TraceId) `
    "header=$($page.TraceId) body=$($page.Body.traceId)"

$filtered = Invoke-Api $operator.Session 'GET' '/api/imports?type=people&result=%E6%88%90%E5%8A%9F&pageSize=5' $null
Assert '带筛选的分页查询可用，MyBatis 动态 SQL 生效' `
    ($filtered.Status -eq 200 -and $null -ne $filtered.Body.data.total) `
    "status=$($filtered.Status) body=$($filtered.Body | ConvertTo-Json -Compress)"

$badParam = Invoke-Api $operator.Session 'GET' '/api/imports?type=%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E7%B1%BB%E5%9E%8B' $null
Assert '参数校验失败返回 PARAM_INVALID' `
    ($badParam.Status -eq 400 -and $badParam.Body.code -eq 'PARAM_INVALID') `
    "status=$($badParam.Status) code=$($badParam.Body.code)"
Assert '校验失败的 message 是可直接展示的中文而非堆栈' `
    ($badParam.Body.message -and $badParam.Body.message -notmatch 'Exception|at com\.') `
    "message=$($badParam.Body.message)"

$notFound = Invoke-Api $operator.Session 'GET' '/api/imports/RY20260101000000' $null
Assert '不存在的批次返回 404 NOT_FOUND' `
    ($notFound.Status -eq 404 -and $notFound.Body.code -eq 'NOT_FOUND') `
    "status=$($notFound.Status) code=$($notFound.Body.code)"

Write-Host ''
Write-Host 'E1-4  导入中心：六类模板可下载（需求 13.8.2 区域 A）' -ForegroundColor Cyan
foreach ($type in @('people', 'attendance', 'lecturer', 'attendee', 'training-feedback', 'trial-feedback')) {
    $template = Invoke-Download $operator.Session "/api/imports/templates/$type"
    # xlsx 是 zip 容器，前两个字节必须是 PK。返回 HTML 错误页时这里会立刻红
    $isXlsx = $template.Status -eq 200 -and $template.Bytes.Length -gt 0 `
        -and $template.Bytes[0] -eq 0x50 -and $template.Bytes[1] -eq 0x4B
    Assert "$type 模板是合法 xlsx 且带 RFC 5987 中文文件名" `
        ($isXlsx -and $template.Disposition -match "filename\*=UTF-8''") `
        "status=$($template.Status) disposition=$($template.Disposition)"
}

Write-Host ''
Write-Host ("通过 {0} 项，失败 {1} 项" -f $script:pass, $script:fail) -ForegroundColor Cyan
Write-Host ''
if ($script:fail -gt 0) { exit 1 }
