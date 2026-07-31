# 构建全部镜像。CI/CD 用本地脚本，不引 GitLab CI 或 Jenkins（《开发实施文档》3.5）。
# 用法：powershell -ExecutionPolicy Bypass -File scripts\build.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

# 先从需求文档第 5 章重新抽取状态机转换表。
# 放在测试之前是刻意的：需求文档一改，CSV 随即变化，参数化测试立刻红灯（出口准则 E1-1）。
# 若只在人工想起时才重跑，引擎的转换表可以悄悄与需求文档脱节而测试全绿。
Write-Host '--- 抽取状态机转换表（需求文档第 5 章）---' -ForegroundColor Cyan
node scripts\statemachine\extract-transitions.mjs
if ($LASTEXITCODE -ne 0) { throw '转换表抽取发现未确认的差异，见上方输出' }

Write-Host '--- 后端测试（含 ArchUnit 架构门禁）---' -ForegroundColor Cyan
Push-Location backend
try {
    .\gradlew.bat test
    if ($LASTEXITCODE -ne 0) { throw '后端测试失败' }
    .\gradlew.bat :platform:statemachine:writeChecklist
    if ($LASTEXITCODE -ne 0) { throw '《状态机转换表核对清单》生成失败' }
} finally {
    Pop-Location
}

Write-Host '--- 前端类型检查与测试 ---' -ForegroundColor Cyan
Push-Location frontend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw '前端构建失败（tsc --noEmit 与 vite build）' }
    npm test -- --run
    if ($LASTEXITCODE -ne 0) { throw '前端测试失败' }
} finally {
    Pop-Location
}

Write-Host '--- 构建镜像 ---' -ForegroundColor Cyan
docker compose build
if ($LASTEXITCODE -ne 0) { throw '镜像构建失败' }

Write-Host '构建完成。' -ForegroundColor Green
