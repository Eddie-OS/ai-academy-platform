# 部署到生产台式机（Windows + WSL2 + Docker Desktop，BLOCK-05）。
# 单实例，发版时短暂中断可接受（决策 C13）。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

# 前置检查。这里原先只判断 .env 是否存在，但真正咬人的两个坑都能通过那道检查：
# 哈希的 $ 未转义（起得来、健康检查绿、登录永远失败），宿主机目录写成容器内路径
# （附件读写正常、备份永远抓不到）。两者都在部署当时毫无征兆，只能在起容器前拦。
# 检查项与理由见 bootstrap.ps1 头部注释。
Write-Host '--- 前置检查 ---' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'bootstrap.ps1')
if ($LASTEXITCODE -ne 0) { throw '前置检查未通过，未执行任何部署动作' }

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
