$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3100'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{
  tenantSlug = 'schoolbook'
  email      = 'teacher@schoolbook.test'
  password   = 'SchoolBookDemo!2026'
} | ConvertTo-Json

$login = Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -Body $loginBody `
  -ContentType 'application/json' -WebSession $session -UseBasicParsing
Write-Output "login=$($login.StatusCode)"

$refresh = Invoke-WebRequest -Uri "$base/api/auth/refresh" -Method Post `
  -WebSession $session -UseBasicParsing
Write-Output "refresh=$($refresh.StatusCode) $($refresh.Content)"

$me = Invoke-WebRequest -Uri "$base/api/auth/me" -WebSession $session -UseBasicParsing
$meJson = $me.Content | ConvertFrom-Json
Write-Output "me=$($me.StatusCode) name=$($meJson.user.firstName) $($meJson.user.lastName) slug=$($meJson.user.tenantSlug) role=$($meJson.user.role)"

$member = Invoke-WebRequest -Uri "$base/api/members/me" -WebSession $session -UseBasicParsing
$memberJson = $member.Content | ConvertFrom-Json
Write-Output "member=$($member.StatusCode) name=$($memberJson.name) role=$($memberJson.role) position=$($memberJson.position)"

$logout = Invoke-WebRequest -Uri "$base/api/auth/logout" -Method Post -WebSession $session -UseBasicParsing
Write-Output "logout=$($logout.StatusCode)"
