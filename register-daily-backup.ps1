param(
  [string]$TaskName = "TheSun Supabase Backup",
  [string]$Time = "02:00",
  [string]$BackupFolder = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $projectRoot "backup-supabase.js"

if (-not (Test-Path $scriptPath)) {
  throw "Cannot find backup-supabase.js"
}

$backupArgument = if ($BackupFolder) { " --backup-folder `"$BackupFolder`"" } else { "" }
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$scriptPath`"$backupArgument"
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Automatic Supabase backup for TheSun project" -Force | Out-Null

if ($BackupFolder) {
  Write-Host "Registered scheduled task '$TaskName' at $Time using backup folder: $BackupFolder"
} else {
  Write-Host "Registered scheduled task '$TaskName' at $Time"
}
