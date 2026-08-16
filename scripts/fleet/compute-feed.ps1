# compute-feed.ps1 - keep cm-node1 working on the most important node1 item.
#
# WS-493. Measured 2026-08-16: the compute runner had ticked cleanly every five minutes for
# ~27 hours and 314 of its 379 ledger events were tick_idle, while six runs_on:node1 items
# sat unclaimed in the poker-tracker queue. The runner was never the missing piece - nothing
# ever handed it work. This is the hand.
#
# WHY THE PULL IS IN HERE AND NOT OPTIONAL. node1's claude-poker-tracker clone is NOT in
# repo-pull.ps1's $Repos list (only ai-personal and homebase are), so nothing refreshes it on
# a cadence. A feeder that skipped the pull would rank a frozen queue forever: it would look
# healthy, submit the same stale top item, and never see a compute_job block authored after
# the last manual pull. Visible failure beats silent staleness, so a failed pull is reported
# and the feed still runs against whatever is on disk rather than exiting quietly.
#
# WHY THIS WRAPPER IS THIN. Everything it can get wrong lives in the repo and syncs; this
# file only bootstraps. It is deliberately stable so it does not itself need syncing.

$ErrorActionPreference = 'Continue'

$Repo    = 'C:\Users\chris\repos\claude-poker-tracker'
$NodeExe = 'C:\Users\chris\.local\node\node.exe'
$Feeder  = Join-Path $Repo 'kit\scripts\cwos-fleet-compute.js'
$StatusPath = Join-Path $env:USERPROFILE 'fleet\compute-feed-status.json'
$LogPath    = Join-Path $env:USERPROFILE 'fleet\compute-feed.log'

$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$pullOk = $false
$pullMsg = $null
$feedOut = $null

# --- 1. sync the queue from G16 (origin already points at the peer clone) -----------------
#
# PULL AND FEED RUN ON DIFFERENT CLOCKS, ON PURPOSE. They were one cadence at first, and the
# cost was measured on 2026-08-16: WS-320 finished at 09:20 and the next 2-hourly tick was
# 11:00, so the machine sat idle 1h40m after a 35-minute job. Simply running the whole thing
# every 10 minutes would have fixed the idle gap by hammering a shutdown-prone laptop with
# twelve times the git traffic.
#
# So the task now fires every 10 minutes and the FEED check — which is cheap and local —
# runs every time, while the pull is rate-limited to $PullIntervalMinutes. The idle window
# after a job completes drops from up to 2h to at most ~10 minutes, at unchanged git cost.
$PullIntervalMinutes = 120
$PullStamp = Join-Path $env:USERPROFILE 'fleet\compute-feed-lastpull.txt'

$needPull = $true
if (Test-Path $PullStamp) {
    try {
        $last = [datetime]::Parse((Get-Content $PullStamp -Raw).Trim()).ToUniversalTime()
        if (((Get-Date).ToUniversalTime() - $last).TotalMinutes -lt $PullIntervalMinutes) { $needPull = $false }
    } catch { $needPull = $true }   # an unreadable stamp means pull, never means skip
}

if (-not (Test-Path (Join-Path $Repo '.git'))) {
    $pullMsg = 'repo not found at ' + $Repo
} elseif (-not $needPull) {
    $pullOk = $true
    $pullMsg = 'skipped (last pull under ' + $PullIntervalMinutes + 'm ago)'
} else {
    $out = (& git -C $Repo pull --rebase --autostash origin main 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) {
        $pullOk = $true
        $pullMsg = $out
        # Stamp only on success: a failed pull must not buy two hours of silence, or a G16
        # that was briefly asleep would freeze the queue until long after it woke up.
        try { (Get-Date).ToUniversalTime().ToString('o') | Out-File -FilePath $PullStamp -Encoding utf8 } catch { }
    } else {
        # G16 is a laptop and is shutdown-prone; an unreachable peer is expected, not an
        # incident. Record it and carry on with the queue already on disk.
        $pullMsg = $out.Substring(0, [Math]::Min(400, $out.Length))
    }
}

$head = (& git -C $Repo rev-parse --short HEAD 2>$null)

# --- 2. feed the runner -------------------------------------------------------------------
if (Test-Path $Feeder) {
    Push-Location $Repo
    $feedOut = (& $NodeExe $Feeder feed 2>&1 | Out-String).Trim()
    $feedExit = $LASTEXITCODE
    Pop-Location
} else {
    $feedOut = 'feeder not found at ' + $Feeder
    $feedExit = 1
}

# --- 3. record ----------------------------------------------------------------------------
# Written on EVERY run, success or failure. An empty report without a timestamp is
# indistinguishable from a dead task, which is the failure repo-pull.ps1 was built to end.
try {
    $dir = Split-Path $StatusPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    $status = [ordered]@{
        ran_at    = $stamp
        pull_ok   = $pullOk
        pull_note = $pullMsg
        head      = $head
        feed_exit = $feedExit
        feed      = $feedOut
    }
    $status | ConvertTo-Json -Depth 4 | Out-File -FilePath $StatusPath -Encoding utf8
    # -Encoding utf8 is required, not tidiness: Add-Content defaults to the system ANSI
    # codepage, and the feeder's own status strings contain em-dashes, which came back as
    # "G??" mojibake in the first scheduled run's log while the JSON status file was fine.
    Add-Content -Path $LogPath -Encoding utf8 -Value ($stamp + '  head=' + $head + '  pull_ok=' + $pullOk + '  ' + ($feedOut -replace '\r?\n', ' | '))
} catch { }

Write-Output ($stamp + ' head=' + $head + ' pull_ok=' + $pullOk)
Write-Output $feedOut

if ($feedExit -ne 0) { exit 1 }
exit 0
