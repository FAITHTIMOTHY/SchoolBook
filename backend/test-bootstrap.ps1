$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Read-EnvValue([string]$name) {
  $line = Get-Content .env | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { throw "$name is missing from backend/.env" }
  return $line.Substring($name.Length + 1).Trim().Trim('"').Trim("'")
}

$databaseUrl = Read-EnvValue 'DATABASE_URL'
$directUrl = Read-EnvValue 'DIRECT_URL'
$schema = 'bootstrap_test'
$separatorDb = if ($databaseUrl.Contains('?')) { '&' } else { '?' }
$separatorDirect = if ($directUrl.Contains('?')) { '&' } else { '?' }
$testDatabaseUrl = "$databaseUrl$separatorDb" + "schema=$schema"
$testDirectUrl = "$directUrl$separatorDirect" + "schema=$schema"

Write-Host "Preparing empty schema '$schema'..."
$env:DIRECT_URL = $directUrl
('DROP SCHEMA IF EXISTS "' + $schema + '" CASCADE;') | npx prisma db execute --stdin
if ($LASTEXITCODE -ne 0) { throw "schema preparation failed with exit code $LASTEXITCODE" }

Write-Host "Applying migrations to '$schema'..."
$env:DIRECT_URL = $testDirectUrl
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed with exit code $LASTEXITCODE" }

Write-Host 'Running the production bootstrap script against the temporary schema...'
$env:DATABASE_URL = $testDatabaseUrl
$env:BOOTSTRAP_SCHOOL_NAME = 'Bootstrap Test School'
$env:BOOTSTRAP_SCHOOL_SLUG = 'bootstrap-test'
$env:BOOTSTRAP_PRINCIPAL_EMAIL = 'principal@bootstrap.test'
$env:BOOTSTRAP_PRINCIPAL_PASSWORD = 'BootstrapTest!2026'
$env:BOOTSTRAP_PRINCIPAL_FIRST_NAME = 'Bootstrap'
$env:BOOTSTRAP_PRINCIPAL_LAST_NAME = 'Principal'
node prisma/bootstrap-school.mjs
if ($LASTEXITCODE -ne 0) { throw "bootstrap failed with exit code $LASTEXITCODE" }

Write-Host 'Dropping temporary schema...'
$env:DATABASE_URL = $databaseUrl
$env:DIRECT_URL = $directUrl
('DROP SCHEMA IF EXISTS "' + $schema + '" CASCADE;') | npx prisma db execute --stdin
if ($LASTEXITCODE -ne 0) { throw "schema cleanup failed with exit code $LASTEXITCODE" }

Write-Host 'Bootstrap test passed.'
