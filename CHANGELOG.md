# Changelog

## 1.1.0

- Add admin account deletion preview, interactive confirmation, job status, and failed-job
  resumption. Requires fresh admin login and the deployed account-deletion API.
- Add reviewed birth previews and confirmations, retained SMS source evidence, birth-history
  settings and evidence, farm tasks, and immutable protocol versions.
- Add private farm export creation, listing, status, cancellation, and checksum-verified download
  without overwriting files. Existing cloud sessions need a new login for export scopes.
- Add local installation login/logout with origin-bound sessions and farm selection, separate
  from cloud credentials. Local login requires an interactive terminal.
- Add current/historical animal inventory filters and explicit inventory status on create/update.
- Fix memory output to honor the server-selected current value, including no current value,
  instead of selecting a historical version.
- Complete optional platform entries in the development lockfile; retain Node 22+ and the
  existing native token-cache locking and cloud credential formats.

Stop older CLI/MCP processes before upgrading. See README for login, permissions, command help,
archive boundaries, and deletion recovery. Birth confirmation and ordinary write commands modify
farm data; review their inputs before execution.

## 1.0.0

Initial public CLI release: farm-data commands, browser device login, admin imports, read-only
observer inspection, and OS-managed token-cache locking.
