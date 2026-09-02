param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Message
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param([string]$FilePath, [string[]]$ArgumentList)
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($ArgumentList -join ' ')"
  }
}

if (-not (Test-Path ".git")) {
  throw "Git repository is not initialized. Run: git init; git branch -M main"
}

Write-Host "1/3 Preflight"
& ".\scripts\preflight-beta.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "2/3 Review changes"
Invoke-Step "git" @("status", "--short")
Invoke-Step "git" @("diff", "--check")

$secretFiles = git status --porcelain |
  Select-String -Pattern '(^|\s)(\.env($|\.)|.*\.env\.local$|\.vercel[\\/])' |
  Where-Object { $_.Line -notmatch '(^|\s)\.env\.example$' }
if ($secretFiles) {
  throw "Potential secret/local environment file is visible to Git. Stop and review .gitignore before committing."
}

Write-Host "3/3 Commit"
Invoke-Step "git" @("add", "-A")
Invoke-Step "git" @("diff", "--cached", "--check")
Invoke-Step "git" @("commit", "-m", $Message)

Write-Host "Commit created. Review with: git show --stat --oneline HEAD"
Write-Host "Push only after review: git push"
