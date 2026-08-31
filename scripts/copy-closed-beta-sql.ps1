$ErrorActionPreference = "Stop"
$path = Join-Path $PSScriptRoot "..\supabase\bootstrap\20260831_closed_beta.sql"
if (-not (Test-Path -LiteralPath $path)) {
  throw "Bootstrap SQL file not found: $path"
}
Get-Content -LiteralPath $path -Raw -Encoding UTF8 | Set-Clipboard
Write-Host "Closed-beta SQL copied to clipboard."
