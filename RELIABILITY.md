# Reliability release 2.4.1

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
Check Settings for web build **v2.4.1**, then test with a backup retained off-device.
Do not clear site/Chrome data to force an update. If old app windows are open,
close and reopen them so they load the updated cached release.

No live deployment or physical-device test is implied by the local test results.
