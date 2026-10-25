$ErrorActionPreference = 'Continue'

$pw = ((Get-Content .env | Where-Object { $_ -match '^SEED_ADMIN_PASSWORD=' }) -replace '^SEED_ADMIN_PASSWORD=','').Trim()
$body = @{ tenantSlug = 'schoolbook'; email = 'admin@schoolbook.test'; password = $pw } | ConvertTo-Json

try {
  $login = Invoke-RestMethod -Uri 'http://localhost:3100/api/auth/login' -Method Post -ContentType 'application/json' -Body $body -SessionVariable s -TimeoutSec 60
  Write-Output "LOGIN -> OK $($login.user.email) / $($login.user.role)"
} catch {
  Write-Output "LOGIN -> ERR $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Output $_.ErrorDetails.Message }
  exit 1
}

$paths = @(
  '/api/status',
  '/api/auth/me',
  '/api/tenants',
  '/api/members',
  '/api/units',
  '/api/attendance/sheet?date=2026-10-25&serviceName=Morning%20Roll%20Call',
  '/api/attendance/stats',
  '/api/inventory',
  '/api/financials',
  '/api/financials/projections',
  '/api/messaging',
  '/api/portal'
)

foreach ($path in $paths) {
  try {
    $response = Invoke-WebRequest -Uri ("http://localhost:3100" + $path) -WebSession $s -UseBasicParsing -TimeoutSec 60
    $content = $response.Content
    if ($content.Length -gt 220) { $content = $content.Substring(0, 220) + '...' }
    Write-Output "$path -> $($response.StatusCode) $content"
  } catch {
    Write-Output "$path -> ERR $($_.Exception.Message)"
    if ($_.ErrorDetails) { Write-Output $_.ErrorDetails.Message }
  }
}

foreach ($path in @('/', '/app', '/login')) {
  try {
    $response = Invoke-WebRequest -Uri ("http://localhost:3100" + $path) -UseBasicParsing -TimeoutSec 15
    Write-Output "$path -> $($response.StatusCode) $($response.Headers['Content-Type']) $($response.RawContentLength)b"
  } catch {
    Write-Output "$path -> ERR $($_.Exception.Message)"
  }
}
