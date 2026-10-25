$ErrorActionPreference = 'SilentlyContinue'

Get-NetTCPConnection -LocalPort 3100 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

Start-Sleep -Seconds 2

$env:PORT = '3100'
Start-Process -FilePath node `
  -ArgumentList 'dist/main.js' `
  -WorkingDirectory (Get-Location) `
  -RedirectStandardOutput 'server.out.log' `
  -RedirectStandardError 'server.err.log' `
  -WindowStyle Hidden

Start-Sleep -Seconds 7

try {
  $response = Invoke-WebRequest -Uri 'http://localhost:3100/health' -UseBasicParsing -TimeoutSec 30
  Write-Output "HEALTH $($response.StatusCode) $($response.Content)"
} catch {
  Write-Output "HEALTH ERROR: $($_.Exception.Message)"
  Get-Content server.err.log -Tail 30
}
