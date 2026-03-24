#Requires -Version 5.1
<#
  Commit agent-generator-web, push to GitHub. Vercel should build from Git with
  Project Settings → Root Directory = agent-generator-web.
  Optional: from repo root, `npx vercel --prod` after `vercel link` (uploads full repo so Root Directory works).
#>
param(
  [string] $Message = "chore: sync agent-generator-web"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$branch = (git branch --show-current).Trim()

git add agent-generator-web scripts/push-and-vercel.ps1 2>$null
$names = git diff --cached --name-only
if ($names) {
  git commit -m $Message
} else {
  Write-Host "Nothing staged (agent-generator-web / script)."
}

git push -u origin $branch

Write-Host "Pushed. Ensure Vercel project has Root Directory = agent-generator-web, then Git deploy will succeed."
Write-Host "Done."
