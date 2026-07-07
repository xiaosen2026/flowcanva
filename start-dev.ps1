Write-Host "=== FlowCanva 开发模式启动 ===" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$jobs = @()

$env:DEV_MODE = "true"
$jobs += Start-Process -FilePath "go" -ArgumentList "run ." -WorkingDirectory "$root\backend" -PassThru -WindowStyle Minimized
Write-Host "✓ 后端代理 :6789" -ForegroundColor Green

Start-Sleep -Seconds 2

$jobs += Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "$root\frontend-admin" -PassThru -WindowStyle Minimized
Write-Host "✓ 控制台 :5174" -ForegroundColor Green

$jobs += Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "$root\frontend-canvas" -PassThru -WindowStyle Minimized
Write-Host "✓ 画布   :5173" -ForegroundColor Green

Write-Host ""
Write-Host "统一入口:" -ForegroundColor Cyan
Write-Host "  http://localhost:6789   → 所有页面" -ForegroundColor Yellow
Write-Host ""
Write-Host "按任意键停止所有服务..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

foreach ($job in $jobs) {
    if (-not $job.HasExited) {
        Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "所有服务已停止" -ForegroundColor Red
