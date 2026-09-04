# 阶段出口冒烟测试：按《开发实施文档》8.4 的 E0-1～E0-5 逐条走一遍真实 HTTP 请求。
#
# 前置：docker compose -f docker-compose.local.yml up -d 已起库，后端已在 8080 端口运行。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
#
# 每个阶段验收都跑这个脚本；新增出口准则时在末尾追加 Assert 段落，不要另起脚本。
#
# 1C 起断言对象从骨架示例接口改为导入中心与附件接口（骨架表与四层代码已由 V1_009 删除）。
# 选它们的理由：附件的「申请上传 → 传分片 → 合并」是 JSON + multipart 都覆盖、且真的往
# sys_attachment 写行的最短写路径。
#
# 阶段 1 人工验收（阶段文档第六章动作 2、3、5）追加了三段导入断言，需要真的 .xlsx：
# 做法是下载后端模板再往里插数据行，见 New-DataFile。E1-7 那段依赖造数脚本写的培训场次，
# 远端栈上查不到场次时报 SKIP 而不是 FAIL。

$ErrorActionPreference = 'Stop'

# 默认打本地开发环境（后端直连 8080）。打生产栈时目标改成 http://localhost（走 Nginx）。
#
# 两个口令没有默认值：仓库里不留任何口令字面量。本地填 .env 里 LOCAL_OPERATOR_PASSWORD /
# LOCAL_VIEWER_PASSWORD 那两个值，打生产栈时填 .env 里两个哈希对应的原文：
#   $env:SMOKE_BASE_URL='http://localhost'
#   $env:SMOKE_OPERATOR_PASSWORD='...'; $env:SMOKE_VIEWER_PASSWORD='...'
$base = if ($env:SMOKE_BASE_URL) { $env:SMOKE_BASE_URL } else { 'http://localhost:8080' }
if (-not $env:SMOKE_OPERATOR_PASSWORD -or -not $env:SMOKE_VIEWER_PASSWORD) {
    throw '请先设置 SMOKE_OPERATOR_PASSWORD 与 SMOKE_VIEWER_PASSWORD（本地即 .env 里的 LOCAL_OPERATOR_PASSWORD / LOCAL_VIEWER_PASSWORD）'
}
$operatorPassword = $env:SMOKE_OPERATOR_PASSWORD
$viewerPassword = $env:SMOKE_VIEWER_PASSWORD

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

# 响应头是 application/json 不带 charset（Spring 默认就不带），PowerShell 5.1 于是按
# ISO-8859-1 解码，「人员」变成「äººå」。断言里凡是比中文的全会假红，而假红比不测更糟：
# 下次真出问题时没人会当回事。
#
# 成功响应直接拿 RawContentStream 的原始字节按 UTF-8 解。
function Read-Utf8Body($response) {
    $stream = $response.RawContentStream
    if (-not $stream) { return ConvertTo-Text $response.Content }
    $stream.Position = 0
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $text = $reader.ReadToEnd()
    $stream.Position = 0
    return $text
}

# 4xx/5xx 时响应流已被 Invoke-WebRequest 读空，只剩 ErrorDetails 里那个已经解错的字符串，
# 拿不到原始字节。ISO-8859-1 是 0x00–0xFF 的一对一映射，把字符按它转回字节再按 UTF-8 重解
# 即可无损还原。仅在响应头确实没声明 charset 时才做，声明了的话这么转反而会转坏。
function Repair-Utf8($text, $contentType) {
    if (-not $text -or ($contentType -and $contentType -match 'charset')) { return $text }
    return [System.Text.Encoding]::UTF8.GetString(
        [System.Text.Encoding]::GetEncoding(28591).GetBytes($text))
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
    $resp = $errorRecord.Exception.Response
    # 三元运算符是 PowerShell 7 才有的，5.1 上只能这么写
    $contentType = if ($resp) { $resp.ContentType } else { $null }
    $raw = Repair-Utf8 $errorRecord.ErrorDetails.Message $contentType
    if (-not $raw -and $resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(),
            [System.Text.Encoding]::UTF8)
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
            Body    = (Read-Utf8Body $response | ConvertFrom-Json)
            TraceId = $response.Headers['X-Trace-Id']
            Bytes   = $response.Content
        }
    } catch [System.Net.WebException] {
        return Read-ErrorResponse $_
    }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

# xlsx 是 zip 容器，PowerShell 5.1 没有 Excel 库，因此**不自己造 xlsx，而是往后端下发的模板里
# 追加数据行**：解开 zip、往 sheet1.xml 的 </sheetData> 前插 <row>、再压回去。
#
# 这样做不只是省事，它还消掉了一个失败模式：手写的表头一旦与模板差一个字，
# 上传就会被判「表头不一致」，而这个错看起来像是被测功能坏了，不像是脚本自己写错了。
#
# 模板第 1 行是表头、第 2 行是 [示例] 行（规则 I2），所以数据从第 3 行起——
# 这正是运营「下载模板、在示例行下面接着填」的行号，错误报告里的行号能直接拿来核对。
function New-DataFile($templateBytes, $rows) {
    # 只传一行时 PowerShell 会把 @(@('a','b')) 拍平成 @('a','b')，于是「1 行 7 列」被当成
    # 「7 行 1 列」，导入端报出 28 个必填错。收到扁平数组就还原成单行
    if ($rows.Count -gt 0 -and $rows[0] -isnot [System.Array]) { $rows = @(, $rows) }

    $path = Join-Path $env:TEMP ('smoke-' + [Guid]::NewGuid().ToString('N') + '.xlsx')
    [System.IO.File]::WriteAllBytes($path, $templateBytes)

    $zip = [System.IO.Compression.ZipFile]::Open($path, 'Update')
    try {
        $entry = $zip.GetEntry('xl/worksheets/sheet1.xml')
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $xml = $reader.ReadToEnd()
        $reader.Dispose()

        $builder = New-Object System.Text.StringBuilder
        $rowNo = 3
        foreach ($row in $rows) {
            [void]$builder.Append("<row r=`"$rowNo`">")
            for ($i = 0; $i -lt $row.Count; $i++) {
                $text = [string]$row[$i]
                if ($text -eq '') { continue }   # 空单元格整个不写，解析端按空值处理
                $column = [char](65 + $i)
                $escaped = [System.Security.SecurityElement]::Escape($text)
                [void]$builder.Append("<c r=`"$column$rowNo`" t=`"inlineStr`"><is><t>$escaped</t></is></c>")
            }
            [void]$builder.Append('</row>')
            $rowNo++
        }

        # 用 String.Replace 而不是 -replace：插入的 XML 里若出现 $ 会被正则替换当成分组引用
        $xml = $xml.Replace('</sheetData>', $builder.ToString() + '</sheetData>')
        $xml = [regex]::Replace($xml, '<dimension ref="A1:([A-Z]+)\d+"\s*/>',
            ('<dimension ref="A1:$1' + ($rowNo - 1) + '"/>'))

        $stream = $entry.Open()
        $stream.SetLength(0)
        $writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
        $writer.Write($xml)
        $writer.Dispose()
    } finally {
        $zip.Dispose()
    }

    $bytes = [System.IO.File]::ReadAllBytes($path)
    Remove-Item $path -Force
    return $bytes
}

# 读回 xlsx（只用来核对错误报告的内容）。EasyExcel 写出来的是 inlineStr，
# 但共享字符串的分支也一并处理：换个写法就读不出来的读取器，验收时会误报成功能坏了。
function Read-XlsxRows($bytes) {
    $path = Join-Path $env:TEMP ('smoke-' + [Guid]::NewGuid().ToString('N') + '.xlsx')
    [System.IO.File]::WriteAllBytes($path, $bytes)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    try {
        $shared = @()
        $sharedEntry = $zip.GetEntry('xl/sharedStrings.xml')
        if ($sharedEntry) {
            $reader = New-Object System.IO.StreamReader($sharedEntry.Open(), [System.Text.Encoding]::UTF8)
            $sharedXml = [xml]$reader.ReadToEnd()
            $reader.Dispose()
            if ($sharedXml.sst.si) { $shared = @($sharedXml.sst.si | ForEach-Object { [string]$_.t }) }
        }

        $reader = New-Object System.IO.StreamReader($zip.GetEntry('xl/worksheets/sheet1.xml').Open(),
            [System.Text.Encoding]::UTF8)
        $sheet = [xml]$reader.ReadToEnd()
        $reader.Dispose()

        $rows = @()
        foreach ($row in @($sheet.worksheet.sheetData.row)) {
            $cells = @()
            foreach ($cell in @($row.c)) {
                if ($cell.t -eq 'inlineStr') {
                    $cells += [string]$cell.'is'.t
                } elseif ($cell.t -eq 's') {
                    $cells += [string]$shared[[int]$cell.v]
                } else {
                    $cells += [string]$cell.v
                }
            }
            $rows += , $cells
        }
        return $rows
    } finally {
        $zip.Dispose()
        Remove-Item $path -Force
    }
}

# 上传一个文件走第一步校验，返回 ImportPreview。
function Invoke-Upload($session, $type, $fileName, $bytes) {
    return Invoke-Multipart $session 'POST' "/api/imports/$type/uploads" $fileName $bytes
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
            Body    = (Read-Utf8Body $response | ConvertFrom-Json)
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
Write-Host '规则 I3 I4  先校验后写入：错误报告指出行号与原因（人工验收动作 2）' -ForegroundColor Cyan

# 工号带运行时间戳：人员导入按工号 upsert，复用同一个工号会让下一次运行走 UPDATE 分支，
# 断言的语义就悄悄变了（本该验「新增 2 行」，实际验的是「更新 2 行」）
$runTag = (Get-Date).ToString('MMddHHmmss')
$noA = "ACC$runTag-A"
$noB = "ACC$runTag-B"
$noC = "ACC$runTag-C"

$peopleTemplate = Invoke-Download $operator.Session '/api/imports/templates/people'

# 第 4 行两个错（姓名空、人员类型非法），第 5 行一个错（邮箱格式）。
# 三个错分布在两行上，才能验出报告是逐条列而不是每行只报第一条
$badFile = New-DataFile $peopleTemplate.Bytes @(
    @($noA, '验收甲', '客服中心', '高级工程师', 'acc-a@example.com', '两者', '在职'),
    @($noB, '', '客服中心', '', '', '教员', '在职'),
    @($noC, '验收丙', '客服中心', '', 'not-an-email', '学员', '在职')
)
$badUpload = Invoke-Upload $operator.Session 'people' '人员导入-含错行.xlsx' $badFile
$preview = $badUpload.Body.data
Assert '含错行的文件上传后不允许确认（规则 I3）' `
    ($badUpload.Status -eq 200 -and $preview.canConfirm -eq $false -and $preview.errorCount -eq 3) `
    "status=$($badUpload.Status) canConfirm=$($preview.canConfirm) errorCount=$($preview.errorCount)"

function Find-Problem($problems, $rowNo, $column) {
    return $problems | Where-Object { $_.rowNo -eq $rowNo -and $_.column -eq $column } | Select-Object -First 1
}
$emptyName = Find-Problem $preview.errors 4 '姓名'
$badType = Find-Problem $preview.errors 4 '人员类型'
$badEmail = Find-Problem $preview.errors 5 '邮箱'
Assert '错误定位到第 4 行「姓名」，原因是必填项为空' `
    ($emptyName -and $emptyName.reason -eq '必填项不能为空') "problem=$($emptyName | ConvertTo-Json -Compress)"
Assert '错误定位到第 4 行「人员类型」，原因给出可选值且带上原值' `
    ($badType -and $badType.reason -match '只能填' -and $badType.value -eq '教员') `
    "problem=$($badType | ConvertTo-Json -Compress)"
Assert '错误定位到第 5 行「邮箱」，同一次上传里两行的错都报出来' `
    ($badEmail -and $badEmail.reason -match '邮箱格式') "problem=$($badEmail | ConvertTo-Json -Compress)"

$report = Invoke-Download $operator.Session "/api/imports/$($preview.batchNo)/error-report"
$reportRows = Read-XlsxRows $report.Bytes
Assert '错误报告可下载，表头是「行号 列名 错误值 级别 错误原因」（规则 I4）' `
    ($report.Status -eq 200 -and ($reportRows[0] -join ',') -eq '行号,列名,错误值,级别,错误原因') `
    "header=$($reportRows[0] -join ',')"
$reportedType = $reportRows | Where-Object { $_[0] -eq '4' -and $_[1] -eq '人员类型' } | Select-Object -First 1
Assert '报告里第 4 行「人员类型」一行齐全：行号、列名、原值、级别、原因' `
    ($reportedType -and $reportedType[2] -eq '教员' -and $reportedType[3] -eq '错误' -and $reportedType[4] -match '只能填') `
    "row=$($reportedType -join ' | ')"
Assert '报告行数 = 表头 + 3 条错误，没有把正确行也列进去' `
    ($reportRows.Count -eq 4) "count=$($reportRows.Count)"

$confirmBad = Invoke-Api $operator.Session 'POST' "/api/imports/$($preview.batchNo)/confirmation" $null
Assert '校验失败的批次不能确认写入（规则 I3 硬阻断）' `
    ($confirmBad.Status -ge 400 -and $confirmBad.Body.code -eq 'IMPORT_VALIDATION_FAILED') `
    "status=$($confirmBad.Status) code=$($confirmBad.Body.code)"

Write-Host ''
Write-Host 'E1-6  整批撤销后数据回到原状（人工验收动作 3）' -ForegroundColor Cyan

# 第一批：新增两个人。撤销它验的是 INSERT 行的回滚（逻辑删除）
$insertFile = New-DataFile $peopleTemplate.Bytes @(
    @($noA, '验收甲', '客服中心', '高级工程师', 'acc-a@example.com', '两者', '在职'),
    @($noB, '验收乙', '客服中心', '专员', 'acc-b@example.com', '学员', '在职')
)
$insertUpload = Invoke-Upload $operator.Session 'people' '人员导入-新增.xlsx' $insertFile
$batchInsert = $insertUpload.Body.data
Assert '干净文件校验通过，预览显示新增 2 行、更新 0 行' `
    ($batchInsert.canConfirm -eq $true -and $batchInsert.insertRows -eq 2 -and $batchInsert.updateRows -eq 0) `
    "preview=$($batchInsert | ConvertTo-Json -Compress)"

$confirmInsert = Invoke-Api $operator.Session 'POST' "/api/imports/$($batchInsert.batchNo)/confirmation" $null
Assert '确认写入后批次是「已写入 / 成功」' `
    ($confirmInsert.Status -eq 200 -and $confirmInsert.Body.data.batchState -eq '已写入' `
        -and $confirmInsert.Body.data.importResult -eq '成功') `
    "batch=$($confirmInsert.Body.data | ConvertTo-Json -Compress)"

$confirmAgain = Invoke-Api $operator.Session 'POST' "/api/imports/$($batchInsert.batchNo)/confirmation" $null
Assert '重复确认返回 DUPLICATE_SUBMIT（规则 I8 幂等）' `
    ($confirmAgain.Status -ge 400 -and $confirmAgain.Body.code -eq 'DUPLICATE_SUBMIT') `
    "status=$($confirmAgain.Status) code=$($confirmAgain.Body.code)"

# 第二批：把甲的姓名与部门改掉。撤销它验的是 UPDATE 行的回滚——
# 这是撤销里真正难的一半：逻辑删除只要置个标记，还原前值要靠快照里的 JSONB
$updateFile = New-DataFile $peopleTemplate.Bytes @(
    @($noA, '验收甲改名', '培训部', '高级工程师', 'acc-a@example.com', '两者', '在职')
)
$updateUpload = Invoke-Upload $operator.Session 'people' '人员导入-改名.xlsx' $updateFile
$batchUpdate = $updateUpload.Body.data
Assert '同一工号再导入一次被识别为更新而不是新增' `
    ($batchUpdate.canConfirm -eq $true -and $batchUpdate.updateRows -eq 1 -and $batchUpdate.insertRows -eq 0) `
    "preview=$($batchUpdate | ConvertTo-Json -Compress)"
$confirmUpdate = Invoke-Api $operator.Session 'POST' "/api/imports/$($batchUpdate.batchNo)/confirmation" $null
Assert '改名批次写入成功' ($confirmUpdate.Status -eq 200) "status=$($confirmUpdate.Status)"

$revokeUpdate = Invoke-Api $operator.Session 'POST' "/api/imports/$($batchUpdate.batchNo)/revocation" $null
Assert '撤销改名批次：回滚 1 行、跳过 0 行' `
    ($revokeUpdate.Status -eq 200 -and $revokeUpdate.Body.data.revokedRows -eq 1 `
        -and $revokeUpdate.Body.data.skippedRows -eq 0) `
    "result=$($revokeUpdate.Body.data | ConvertTo-Json -Compress)"

$revokeTwice = Invoke-Api $operator.Session 'POST' "/api/imports/$($batchUpdate.batchNo)/revocation" $null
Assert '已撤销的批次不可重复撤销（规则 RB4）' `
    ($revokeTwice.Status -ge 400 -and $revokeTwice.Body.code -eq 'DUPLICATE_SUBMIT') `
    "status=$($revokeTwice.Status) code=$($revokeTwice.Body.code)"

$revokeInsert = Invoke-Api $operator.Session 'POST' "/api/imports/$($batchInsert.batchNo)/revocation" $null
Assert '撤销新增批次：2 行全部回滚' `
    ($revokeInsert.Status -eq 200 -and $revokeInsert.Body.data.revokedRows -eq 2 `
        -and $revokeInsert.Body.data.skippedRows -eq 0) `
    "result=$($revokeInsert.Body.data | ConvertTo-Json -Compress)"

$revokedBatch = Invoke-Api $operator.Session 'GET' "/api/imports/$($batchInsert.batchNo)" $null
Assert '撤销后批次结果标记为「已撤销」，留痕不删（规则 RB5）' `
    ($revokedBatch.Body.data.importResult -eq '已撤销') `
    "importResult=$($revokedBatch.Body.data.importResult)"

$sourceAfterRevoke = Invoke-Download $operator.Session "/api/imports/$($batchInsert.batchNo)/source-file"
Assert '撤销后原文件仍可下载（改完重导是常态）' `
    ($sourceAfterRevoke.Status -eq 200 -and $sourceAfterRevoke.Bytes[0] -eq 0x50) `
    "status=$($sourceAfterRevoke.Status)"

# 注意：本节只验到 HTTP 这一层。「撤销后库里真的回到原状」必须直接查表才算验过，
# 而查表要连库，这个脚本要能打远端栈，所以不在这里连。
# 查库那一步与它的实际输出见 docs/E1-阶段1人工验收报告.md 动作 3。

Write-Host ''
Write-Host 'E1-7  匿名反馈不落身份信息（人工验收动作 5 的导入侧）' -ForegroundColor Cyan

$feedbackTemplate = Invoke-Download $operator.Session '/api/imports/templates/training-feedback'
$sessionNo = 'JH2026070001-01'   # 造数脚本固定生成的已结束场次
$feedbackFile = New-DataFile $feedbackTemplate.Bytes @(
    @($sessionNo, '', '5', "匿名反馈-$runTag"),
    @($sessionNo, 'E0001', '4', "实名反馈-$runTag")
)
$feedbackUpload = Invoke-Upload $operator.Session 'training-feedback' '学员反馈导入.xlsx' $feedbackFile
$feedbackPreview = $feedbackUpload.Body.data

if ($feedbackUpload.Status -eq 200 -and $feedbackPreview.canConfirm -eq $true) {
    Assert '工号留空的反馈行校验通过（选填列，留空即匿名）' `
        ($feedbackPreview.insertRows -eq 2) "preview=$($feedbackPreview | ConvertTo-Json -Compress)"
    Assert '追加语义提示已给出（规则 FB5：已有 N 条、本次追加 M 条）' `
        (($feedbackPreview.notes -join ' ') -match '已有 \d+ 条反馈，本次将追加 \d+ 条') `
        "notes=$($feedbackPreview.notes -join ' / ')"
    $confirmFeedback = Invoke-Api $operator.Session 'POST' "/api/imports/$($feedbackPreview.batchNo)/confirmation" $null
    Assert '匿名 + 实名两行一起写入成功' `
        ($confirmFeedback.Status -eq 200 -and $confirmFeedback.Body.data.importResult -eq '成功') `
        "status=$($confirmFeedback.Status)"
    Write-Host "  批次号 $($feedbackPreview.batchNo)，用它查库核对 submitter_no 是否为 NULL" -ForegroundColor DarkGray
} else {
    # 场次是造数脚本写的，不是导入进来的。远端栈上没造过数时这里必然过不去，
    # 报「跳过」而不是「失败」——否则每次打生产栈都会红一片，红灯就不再有意义
    Write-Host "  SKIP  场次 $sessionNo 不存在。本地库应由 DemoDataSeeder 自动灌好（后端首次以 local profile 启动时）" -ForegroundColor Yellow
    Write-Host "        服务端返回：$($feedbackPreview.errors | ConvertTo-Json -Compress)" -ForegroundColor DarkGray
}

Write-Host ''
Write-Host ("通过 {0} 项，失败 {1} 项" -f $script:pass, $script:fail) -ForegroundColor Cyan
Write-Host ''
if ($script:fail -gt 0) { exit 1 }
