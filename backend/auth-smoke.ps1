$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3100'
$password = 'SchoolBookDemo!2026'

function New-SessionFor([string]$email) {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{
    tenantSlug = 'schoolbook'
    email      = $email
    password   = $password
  } | ConvertTo-Json

  $response = Invoke-WebRequest -Uri "$base/api/auth/login" -Method Post -Body $body `
    -ContentType 'application/json' -WebSession $session -UseBasicParsing -TimeoutSec 60

  Write-Host "LOGIN $email -> $($response.StatusCode)"
  return $session
}

function Get-Json([Microsoft.PowerShell.Commands.WebRequestSession]$session, [string]$path) {
  try {
    $response = Invoke-WebRequest -Uri "$base$path" -WebSession $session -UseBasicParsing -TimeoutSec 60
    return @{ status = $response.StatusCode; body = $response.Content }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    return @{ status = $status; body = '' }
  }
}

function Test-Account([string]$email) {
  $session = New-SessionFor $email
  $me = Get-Json $session '/api/members/me'
  $attendance = Get-Json $session '/api/attendance/sheet?date=2026-10-25&serviceName=Morning%20Roll%20Call'
  $finance = Get-Json $session '/api/financials'
  $portal = Get-Json $session '/api/portal'
  $members = Get-Json $session '/api/members'

  $meSummary = ''
  if ($me.status -eq 200) {
    $parsed = $me.body | ConvertFrom-Json
    $meSummary = "$($parsed.name) | $($parsed.role) | $($parsed.position) | unit=$($parsed.unit_id)"
  }

  Write-Output "  me=$($me.status) [$meSummary] attendance=$($attendance.status) finance=$($finance.status) portal=$($portal.status) members=$($members.status)"

  $logout = Invoke-WebRequest -Uri "$base/api/auth/logout" -Method Post -WebSession $session -UseBasicParsing -TimeoutSec 60
  Write-Output "  logout=$($logout.StatusCode)"
}

$providers = Invoke-WebRequest -Uri "$base/api/auth/providers" -UseBasicParsing
Write-Output "PROVIDERS $($providers.StatusCode) $($providers.Content)"

foreach ($page in @('/login', '/reset-password', '/verify-email', '/app', '/')) {
  $response = Invoke-WebRequest -Uri "$base$page" -UseBasicParsing
  Write-Output "PAGE $page -> $($response.StatusCode) $($response.Headers['Content-Type'])"
}

Test-Account 'principal@schoolbook.test'
Test-Account 'teacher@schoolbook.test'
Test-Account 'bursar@schoolbook.test'
Test-Account 'student001@schoolbook.test'
Test-Account 'guardian001@schoolbook.test'
