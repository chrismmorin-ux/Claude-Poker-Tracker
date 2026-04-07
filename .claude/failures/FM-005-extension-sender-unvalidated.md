# FM-005: Extension Cross-Extension Message Injection

Severity: HIGH
First observed: 2026-04-06 (R3 roundtable)
Last observed: 2026-04-06
Occurrences: Latent (no known exploit, structural vulnerability)

## What Happens

Any co-installed Chrome extension can send messages to the poker tracker service worker via `chrome.runtime.sendMessage` or `chrome.runtime.connect`. The handlers at `service-worker.js` lines 123 and 353 do not check `sender.id`. An attacker extension can call `GET_QUEUED_HANDS` (leak hand data), `DEQUEUE_HANDS` (silently discard captured hands), or inject fake hand data via port messages.

## Root Cause

`chrome.runtime.onMessage` and `chrome.runtime.onConnect` handlers lack `sender.id === chrome.runtime.id` validation.

## Detection

Grep for `onMessage.addListener` and `onConnect.addListener` in extension code. Check that all handlers validate `sender.id`.

## Prevention

Add `if (sender.id !== chrome.runtime.id) return;` at the top of both handlers. See RT-21.

## Related Invariants

NEV-11 (no unescaped innerHTML) is adjacent but distinct. This is a trust boundary violation.
