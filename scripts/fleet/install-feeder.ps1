# install-feeder.ps1 - register Fleet-ComputeFeeder on cm-node1.
#
# Registered from a scp'd file rather than an inline `ssh ... powershell -Command` because
# the inner quoting is stripped on the double hop and a half-parsed Register-ScheduledTask
# is worse than none. Same reason the fleet skill says to copy a script over and run that.
#
# Cadence: every 2 hours, plus at boot. The runner itself ticks every 5 minutes and will
# start a submitted job within that window, so the feeder only has to keep the queue from
# running dry.

$ErrorActionPreference = 'Stop'

$TaskName = 'Fleet-ComputeFeeder'
$Script   = 'C:\Users\chris\fleet\compute-feed.ps1'

if (-not (Test-Path $Script)) { throw "feeder script not found at $Script" }

# Idempotent: drop any prior registration so re-running this is safe.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NonInteractive -NoProfile -ExecutionPolicy Bypass -File "' + $Script + '"')

# A time trigger repeating every 2h indefinitely, plus a boot trigger. The boot trigger
# matters more than it looks: a Surface that hibernates on critical battery does NOT
# auto-resume when AC returns, so the first thing it should do on waking is find out whether
# it owes anyone compute.
$start = (Get-Date).Date
$t1 = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Hours 2)
$t2 = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal -UserId 'CM-NODE1\chris' -LogonType S4U -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($t1, $t2) `
    -Principal $principal -Settings $settings -Description 'WS-493: keep the compute runner fed with the top-ranked runs_on:node1 item' | Out-Null

$info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Output ('registered ' + $TaskName)
Write-Output ('next run: ' + $info.NextRunTime)
