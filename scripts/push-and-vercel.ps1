#Requires -Version 5.1
<#
  Commit, push to origin, and deploy agent-generator-web to Vercel production.
  Usage (from repo root):
    .\scripts\push-and-vercel.ps1
    .\scripts\push-and-vercel.ps1 -Message "fix: connect page"
  Tip: In Vercel → Project → Git, connect this repo and set Production Branch to `main`.
       Then every `git push` deploys automatically; this script is still useful for CLI deploys.
#>
param(
  [string] $Message = "chore: sync agent-generator-web"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
  Write-Warning "Current branch is '$branch', not main. Push anyway? (Continuing.)"
}

git add agent-generator-web scripts/push-and-vercel.ps1 2>$null
$names = git diff --cached --name-only
if ($names) {
  git commit -m $Message
} else {
  Write-Host "Nothing staged to commit (agent-generator-web / deploy script)."
}

git push -u origin $branch

Set-Location (Join-Path $root "agent-generator-web")
npx --yes vercel --prod --yes
Write-Host "Done."
