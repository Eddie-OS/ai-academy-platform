# 部署到生产台式机（Windows + WSL2 + Docker Desktop，BLOCK-05）。
# 单实例，发版时短暂中断可接受（决策 C13）。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

if (-not (Test-Path .env)) {
    throw '缺少 .env：请从 .env.example 复制并填写口令哈希与宿主机目录'
}

Write-Host '--- 拉起服务（Flyway 在 app 启动时自动迁移，规则 DB-1）---' -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'docker compose up 失败' }

Write-Host '--- 等待健康检查 ---' -ForegroundColor Cyan
foreach ($attempt in 1..30) {
    $health = docker compose exec -T app wget -qO- http://localhost:8080/actuator/health 2>$null
    if ($health -match '"UP"') {
        Write-Host "部署成功（第 $attempt 次探测通过）。" -ForegroundColor Green
        exit 0
    }
    Start-Sleep -Seconds 5
}

Write-Host '健康检查未通过，请查看 docker compose logs app' -ForegroundColor Red
exit 1
