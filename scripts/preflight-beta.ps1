$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {
}

function Invoke-NpmCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Script
    )

    Write-Host $Label
    & npm.cmd run $Script

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Error "Preflight остановлен: npm run $Script завершился с кодом $LASTEXITCODE. Исправь ошибку до публикации beta."
        exit $LASTEXITCODE
    }
}

Invoke-NpmCheck "1/4 lint" "lint"
Invoke-NpmCheck "2/4 typecheck" "typecheck"
Invoke-NpmCheck "3/4 unit tests" "test"
Invoke-NpmCheck "4/4 production build" "build"

Write-Host ""
Write-Host "Preflight закрытой beta пройден: lint, typecheck, unit tests и production build успешны."
