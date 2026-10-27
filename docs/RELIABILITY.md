# Reliability release 2.4.4

## Idle and background recovery (2.4.4)

Reviewed on top of the Antigravity 2.4.2 and 2.4.3 changes. A blocked-database
reproduction against 2.4.3 showed Save reporting a timeout and enabling a retry,
then the original write committing after that failure. A foreground event could
also clear the guard while a save was in progress.

- Transactions now own their eight-second timeout and actually abort before
  the UI permits retry. There is no detached UI timeout or wake-time guard reset.
- Reads, attachments, exports and imports share bounded connection recovery.
  Late database-open completions cannot replace a newer connection.
- Attachment reads must finish successfully before an edited expense saves;
  no 2.5-second shortcut can discard bill IDs.
- Overlay/history cleanup has a fallback when Android does not deliver popstate.
  Foreground focus reconciles inert state without discarding an open form.
- Installed release assets are served consistently. A new worker waits for old
  clients to close instead of taking over a form during use. Close the APK and
  any same-site browser tabs, then reopen to load the new worker. Do not clear data.
- Preserve numeric/string vendor-key lookup from 2.4.2, but do not invent missing
  vendor records or write through a failed reference check.

Validation: 21 core checks, six attachment checks, seven idle-recovery checks and
the CSP smoke test pass. Idle tests include a queued transaction, wake during a
save, a missing popstate, delayed attachments, closed export/import connections,
a simulated 30-minute background/PIN interval, and 30 consecutive save/tab cycles.
A separate real 181-second idle test through the compiled desktop launcher saved
and reloaded both a new desktop entry and a pre-filled mobile-sized form without
page errors. This is not a physical Android sleep/OS-kill certification.

For desktop testing, see [`desktop/README.txt`](../desktop/README.txt). Build a portable Windows launcher
with `desktop/build.ps1 -OutputDirectory <new-output-folder>`. It uses Microsoft
Edge, a dedicated profile and a fixed loopback origin. Desktop records do not
automatically sync with the phone.

This release keeps the existing IndexedDB name and schema version, and does not
clear existing business records when the app updates.

## Changes

- Business-data import validates IDs, amounts, dates, field types and relationships
  before writing. Replacement and migration commit in a single transaction.
- Restore failures retain the previous database. Merge conflicts are rejected
  instead of silently overwriting current records. Identical records may merge.
- Database writes finish only when their transaction commits. Aborts reject.
- Saves prevent repeated taps and compare the edited record against current storage.
  New financial entries also check that linked events/vendors still exist.
- Other open app windows receive data-change notifications. Open forms are retained;
  a stale save reports a conflict rather than replacing newer information.
- Expense lists display 100 rows per page; list totals still cover every match.
- Events/vendors with accounting history cannot be deleted until their entries are
  individually resolved. Empty-event deletion includes its draft bills. Cascade
  deletion and Undo use transactions, and Undo no longer expires after six seconds.
- Legacy inline event images migrate to the photos store. Decode failures reject
  instead of hanging. Bill loading/upload completion is checked before saving edits.
- Interrupted bill attachments are recovered as draft expenses at the next launch.
- PIN recovery no longer offers to remove a PIN without verification. Its explanation
  closes correctly before the main app has launched. The normal PIN still unlocks.
- Export is unavailable while locked. After the app is hidden for over one minute,
  returning locks it when a PIN exists, except while a save is in progress.
- The PIN remains a **privacy screen, not encryption**. Forgotten PINs cannot be
  reset through this screen. Existing records remain stored; a prior export can be
  restored into a separate browser profile. Do not clear the original data to test.
- Modal dialogs manage keyboard focus and background inertness. Navigation,
  attachments, confirmation sheets and locked-screen interactions are covered.
- The app requests persistent browser storage where supported and states that an
  off-device backup is required. This release does not add cloud sync or encryption.
- The service worker installs a complete release cache and serves it consistently.
  Its cache cleanup only removes this app's caches. Export and UI version agree.
- Vercel response headers add CSP, anti-framing, nosniff and referrer restrictions.
  Inline script code was externalized. The CSP smoke test applies these headers
  to local responses; live production headers change only after deployment.

## Tests

Install Node.js and Microsoft Edge, then run:

```sh
npm ci
npm test
```

The runner starts its own server on a random loopback port. It uses fresh headless
Edge profiles and synthetic records, never the live website or a real phone store.
Tests refuse an external URL. Results/screenshots are saved in `test-artifacts/`.

Coverage includes malformed/late-failing restore rollback, six-store round trip,
aborted transactions, migration retries, merge conflicts, duplicate clicks, stale
forms, quota-error messaging, PIN behavior, keyboard focus, attachment recovery,
real image upload, expense Undo with photos, download/restore, 10,000 expenses,
pagination, offline retention, mobile widths and a CSP/dark-Marathi smoke test.

Desktop browser emulation does not verify physical Android camera, native sharing,
process-death timing, browser eviction, the installed APK or its active browser.

## Deploying to the existing APK

The supplied APK launches the existing Vercel site as a Trusted Web Activity.
The web fixes take effect after this source is deployed there and the phone's
service worker updates. Reinstalling the APK is not required for the web fixes.
Check Settings for web build **v2.4.4**, then test with a backup retained off-device.
Do not clear site/Chrome data to force an update. If old app windows are open,
close and reopen them so they load the updated cached release.

The v2.4.4 release was deployed. Physical-device sleep/OS-kill testing remains outside the browser validation described here.
