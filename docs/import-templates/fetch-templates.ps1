# 从运行中的后端拉取六类导入模板到本目录。
# 前置：已登录会话较麻烦，本地可用 curl 带 Cookie；此处用 Invoke-WebRequest 登录后下载。
# 用法：powershell -ExecutionPolicy Bypass -File docs\import-templates\fetch-templates.ps1

$ErrorActionPreference = 'Stop'
$base = if ($env:PERF_BASE_URL) { $env:PERF_BASE_URL } else { 'http://localhost:8080' }
$outDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$password = if ($env:SMOKE_OPERATOR_PASSWORD) { $env:SMOKE_OPERATOR_PASSWORD } else { 'operator123' }

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$null = Invoke-WebRequest -Uri "$base/api/meta/enums" -WebSession $session -UseBasicParsing
$token = ($session.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }).Value
$headers = @{ 'X-XSRF-TOKEN' = $token }
$body = (@{ username = 'operator'; password = $password } | ConvertTo-Json)
$null = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -Body $body `
    -ContentType 'application/json; charset=utf-8' -Headers $headers -WebSession $session -UseBasicParsing

$types = @('EMPLOYEE', 'ATTENDANCE', 'LECTURER', 'ATTENDEE', 'STUDENT_FEEDBACK', 'TRIAL_FEEDBACK')
foreach ($t in $types) {
    $path = Join-Path $outDir "$t.xlsx"
    Invoke-WebRequest -Uri "$base/api/imports/templates/$t" -WebSession $session -OutFile $path -UseBasicParsing
    Write-Host "wrote $path"
}
Write-Host 'done'
