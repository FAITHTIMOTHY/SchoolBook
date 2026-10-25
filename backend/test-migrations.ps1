$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$line = Get-Content .env | Where-Object { $_ -match '^DIRECT_URL=' } | Select-Object -First 1
if (-not $line) { throw 'DIRECT_URL is missing from backend/.env' }
$url = $line.Substring('DIRECT_URL='.Length).Trim().Trim('"').Trim("'")
$separator = if ($url.Contains('?')) { '&' } else { '?' }
$schema = 'baseline_test'
$testUrl = "$url$separator" + "schema=$schema"

Write-Host "Preparing empty schema '$schema'..."
$env:DIRECT_URL = $url
('DROP SCHEMA IF EXISTS "' + $schema + '" CASCADE;') | npx prisma db execute --stdin
if ($LASTEXITCODE -ne 0) { throw "schema preparation failed with exit code $LASTEXITCODE" }

Write-Host "Testing all migrations against schema '$schema'..."
$env:DIRECT_URL = $testUrl
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed with exit code $LASTEXITCODE" }

Write-Host 'Dropping temporary schema...'
$env:DIRECT_URL = $url
('DROP SCHEMA IF EXISTS "' + $schema + '" CASCADE;') | npx prisma db execute --stdin
if ($LASTEXITCODE -ne 0) { throw "schema cleanup failed with exit code $LASTEXITCODE" }

Write-Host 'Fresh-schema migration test passed.'
