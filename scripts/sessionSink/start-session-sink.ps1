# Bring up the local hand sink, and keep it up.
#
# The sink (scripts/sessionSink/serve.mjs) is what puts a played hand on disk where the review
# runner can read it. Without it, hands live only in browser storage and no node-side instrument
# can see them — which is the whole reason a session could not be reviewed automatically.
#
# Run at logon, and re-run by an action on the EXISTING Fleet-SessionSweep task rather than by a
# scheduled task of its own. That is ADR-065's rule — "one scheduling surface to verify, one
# place to look when it stops" — and this machine already carries ten Fleet-* tasks with no
# declarative inventory, so adding an eleventh would make that worse.
#
# Safe to run by hand and safe to run twice: it exits early when the port is already listening.
#
# AVAILABILITY IS BEST-EFFORT AND MUST STAY THAT WAY. Nothing in the capture path may depend on
# this being up. A hand the sink misses stays flagged in the extension's durable journal and goes
# out on the next backfill. If the sink never runs, the founder loses a review, never a hand.
#
#   .\start-session-sink.ps1            # start it if it is not already listening
#   .\start-session-sink.ps1 -Install   # add the keepalive action to Fleet-SessionSweep
#   .\start-session-sink.ps1 -Status    # is it up, and what does it say about itself

[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Status,
    [int]$Port = 8791
)

$ErrorActionPreference = 'Stop'

$repo   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$serve  = Join-Path $repo 'scripts\sessionSink\serve.mjs'
$logDir = Join-Path $env:USERPROFILE 'fleet'
$log    = Join-Path $logDir 'session-sink.log'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

# -Encoding utf8 matters: PS 5.1's Add-Content defaults to the system ANSI codepage, which makes
# the log unreadable to every other tool that opens it.
function Note($m) {
    $line = "$(Get-Date -Format s)  $m"
    Write-Output $line
    Add-Content -Path $log -Value $line -Encoding utf8
}

function Test-SinkListening {
    [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
# -Status
# ---------------------------------------------------------------------------
if ($Status) {
    if (Test-SinkListening) {
        Write-Output "session sink: LISTENING on 127.0.0.1:$Port"
        try {
            $s = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 5
            Write-Output "  store        : $($s.root)"
            Write-Output "  open sessions: $($s.openSessions.Count)"
            Write-Output "  accepted     : $($s.counters.accepted)  duplicates: $($s.counters.duplicates)  refused: $($s.counters.refused)"
            Write-Output "  sealed       : $($s.counters.sealed)  reviews spawned: $($s.counters.reviewsSpawned)  review failures: $($s.counters.reviewFailures)"
            if ($s.recentErrors.Count -gt 0) {
                Write-Output "  recent errors:"
                $s.recentErrors | Select-Object -First 5 | ForEach-Object { Write-Output "    $($_.at) $($_.where): $($_.message)" }
            }
        } catch {
            Write-Output "  (port is listening but /status did not answer: $($_.Exception.Message))"
        }
    } else {
        Write-Output "session sink: NOT RUNNING on 127.0.0.1:$Port"
    }
    exit 0
}

# ---------------------------------------------------------------------------
# -Install — append a keepalive action to Fleet-SessionSweep
# ---------------------------------------------------------------------------
if ($Install) {
    $taskName = 'Fleet-SessionSweep'
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Error "$taskName does not exist on this machine. It is the shared scheduling surface this keepalive is meant to ride on (ADR-065). Register it first rather than creating a sibling task for the sink."
        exit 1
    }

    $ps      = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $thisArg = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""

    # Idempotent: if our action is already on the task, leave it alone. Re-adding it on every
    # install would grow the action list without bound and start the sink several times a tick.
    $already = $task.Actions | Where-Object { $_.Arguments -like '*start-session-sink.ps1*' }
    if ($already) {
        Note "keepalive action already present on $taskName - nothing to do"
        exit 0
    }

    $newAction = New-ScheduledTaskAction -Execute $ps -Argument $thisArg
    $actions   = @($task.Actions) + $newAction
    Set-ScheduledTask -TaskName $taskName -Action $actions | Out-Null

    # Verify rather than assume. A silent Set- that did not take would leave the founder
    # believing the sink is supervised when it is not.
    $after = (Get-ScheduledTask -TaskName $taskName).Actions |
        Where-Object { $_.Arguments -like '*start-session-sink.ps1*' }
    if (-not $after) {
        Write-Error "Set-ScheduledTask reported success but the action is not on $taskName."
        exit 1
    }
    Note "keepalive action added to $taskName (now $((Get-ScheduledTask -TaskName $taskName).Actions.Count) actions)"
    Write-Output "Installed. $taskName will restart the sink whenever it is not listening."
    exit 0
}

# ---------------------------------------------------------------------------
# Default — start it if it is not already up
# ---------------------------------------------------------------------------
if (Test-SinkListening) {
    # Not worth a log line on every 15-minute tick; "already up" is the desired state and
    # writing it would bury the events that matter.
    exit 0
}

if (-not (Test-Path $serve)) {
    Note "FATAL serve.mjs missing at $serve"
    exit 1
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { Note "FATAL node not found"; exit 1 }

Note "starting session sink on 127.0.0.1:$Port"
Start-Process -FilePath $node -ArgumentList "`"$serve`"" -WorkingDirectory $repo -WindowStyle Hidden

# Bounded wait, then report the truth. A start that silently failed must not look like a success.
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
    if (Test-SinkListening) { Note "session sink is listening on 127.0.0.1:$Port"; exit 0 }
    Start-Sleep -Milliseconds 500
}
Note "WARN session sink did not begin listening within 20s"
exit 1
