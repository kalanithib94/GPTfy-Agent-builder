#Requires -Version 5.1
<#
  Commit agent-generator-web + root vercel.json, push to Git, then deploy from repo root
  (Vercel Root Directory empty — build is driven by root vercel.json).
#>
param(
  [string] $Message = "chore: sync agent-generator-web"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$branch = (git branch --show-current).Trim()

git add agent-generator-web vercel.json scripts/push-and-vercel.ps1 2>$null
$names = git diff --cached --name-only
if ($names) {
  git commit -m $Message
} else {
  Write-Host "Nothing staged (agent-generator-web / vercel.json / script)."
}

git push -u origin $branch

Set-Location $root
npx --yes vercel --prod --yes
Write-Host "Done."
