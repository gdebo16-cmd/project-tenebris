# Make a separate working folder (git worktree) for one AI, so several can work at once without clashing.
#
#   .\scripts\new-worktree.ps1 -Name grokbot -Port 4002 -WebPort 5175
#
# Creates C:\Users\gdebo\Projects\tenebris-<Name> on a new branch bot/<Name>,
# copies your .env with its own ports, and installs packages there.
# Run it from the main project-tenebris folder. It never deletes anything.

param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][int]$WebPort
)

$ErrorActionPreference = 'Stop'
$main   = (git rev-parse --show-toplevel).Trim()
$target = Join-Path (Split-Path $main -Parent) "tenebris-$Name"
$branch = "bot/$Name"

if (Test-Path $target) { throw "$target already exists - nothing changed." }
if (-not (Test-Path (Join-Path $main '.env'))) { throw "No .env in $main - nothing changed." }

# 1. New folder on its own branch, starting from the current main
git -C $main worktree add $target -b $branch main
if ($LASTEXITCODE -ne 0) { throw "git worktree add failed." }

# 2. Same .env, but with this worktree's own ports
$envText = Get-Content (Join-Path $main '.env') -Raw
$envText = [regex]::Replace($envText, '(?m)^\s*(PORT|WEB_PORT)\s*=.*\r?\n?', '')
$envText = $envText.TrimEnd() + "`r`nPORT=$Port`r`nWEB_PORT=$WebPort`r`n"
Set-Content -Path (Join-Path $target '.env') -Value $envText -NoNewline

# 3. Packages (each worktree needs its own node_modules)
Push-Location $target
try { npm install } finally { Pop-Location }

Write-Host ""
Write-Host "Ready: $target"
Write-Host "  branch  $branch"
Write-Host "  server  http://localhost:$Port   web  http://localhost:$WebPort"
Write-Host "Point $Name at this folder, not the main one."
