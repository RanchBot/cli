# Ranch.Bot CLI

Read and manage Ranch.Bot farm data from your terminal or an agent harness.
Requires Node.js 22+ and a Ranch.Bot account with access to a farm.

## Install

```bash
npm install -g @ranchbot/cli@1.1.0
ranchbot --version
ranchbot --help
```

Or run without a global installation:

```bash
npx -y @ranchbot/cli@1.1.0 --help
```

Stop all older CLI/MCP processes before upgrading. See the locking and upgrade notes below.

## Sign in and select a farm

```bash
ranchbot login
ranchbot whoami --json
ranchbot farms list --json
ranchbot farms use <farm_id>
ranchbot animals list --json
ranchbot logout
```

Open the URL printed by `login` in your browser, sign in, and approve the displayed code.
Select a farm ID from `farms list`. Use `--farm <id>` to override the saved farm for one command.
Help and version commands work without signing in. Ordinary sessions refresh automatically when
needed. `logout` revokes the refresh session and removes the local credentials.

Normal credentials can create, update, and delete data according to your server permissions.
Ordinary farm-data commands do not ask for per-operation confirmation. Admin account deletion
has a separate interactive confirmation described below.
CLI writes do not pass through the app review screen or its Action-backed Change History.
Review write commands before running them or allowing an agent to execute them.

Credentials are stored at `~/.ranchbot/tokens.json`; the selected farm is stored at
`~/.ranchbot/config.json`. These are separate from the MCP server cache at
`~/.ranchbot-mcp-tokens.json`. Treat credential files as secrets; do not print or share them.

## Shared command flags

Every leaf command accepts these flags (place them after the leaf command, as in the examples):

| Flag                                                         | Purpose                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `-j, --json`                                                 | Machine-readable JSON on stdout (agents always set this).                   |
| `--farm <id>`                                                | Use this farm for one command (overrides the default).                      |
| `--api-url <url>` / `--api-version <v>` / `--client-id <id>` | Overrides; rarely needed. `--client-id` cannot replace the observer client. |
| `--local`                                                    | Use installation accounts and a separate origin-bound session cache.        |
| `--profile <name>`                                           | Credential profile: `default` or read-only `observer`.                      |

Complex payloads (`--data`) accept inline JSON, `@file.json`, or `-` (stdin).

## Commands

| Group                         | Commands                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `login` / `logout` / `whoami` | OAuth device flow, sign out, session + farm status.                                                             |
| `farms`                       | `list`, `get <id>`, `use <id>`                                                                                  |
| `animals`                     | `list`, `get <id>`, `create`, `update <id>`, `delete <id>`, `find-by-eid <eid>`                                 |
| `identifiers`                 | `list <animal_id>`, `add <animal_id> --type --value [--primary]`, `remove <animal_id> <id>`                     |
| `groups`                      | `list`, `get <id>`, `create --name [--description]`, `update <id>`, `delete <id>`                               |
| `records`                     | `list [--type]`, `get <id>`, `create --name --type --applied-at --animal/--group`, `update <id>`, `delete <id>` |
| `chute`                       | `list [--status]`, `get <id>`, `create --data <widgets>`, `update <id> --data <widgets>` (propose only)         |
| `birth-events`                | `preview --data`, `confirm --data`, `list [--animal <id>]`, `get <id>`                                          |
| `birth-history`               | `settings`, `configure --data`, `evidence --dam <id> --date YYYY-MM-DD`                                         |
| `birth-sources`               | `get <sourceSmsId>`                                                                                             |
| `farm-tasks`                  | `list [--status]`, `update <id> --data`                                                                         |
| `protocols`                   | `list`, `create --data`                                                                                         |
| `rations`                     | `list [--include-inactive]`, `get <id>`, `create --data <ration>` (structure only)                              |
| `feedings`                    | `list [--status] [--since]`, `get <id>` (read-only)                                                             |
| `exports`                     | `create`, `list`, `status <id>`, `cancel <id>`, `download <id> --output <path>`                                 |
| `imports`                     | `list`, `get <id>`, `update-status <id> --status <status> --summary <summary>` (admin)                          |
| `accounts`                    | `delete --phone <phone> [--dry-run]`, `deletion-status <id>`, `resume-deletion <id>` (admin)                    |
| `inspect`                     | `sms --latest/--message-sid <sid>/--record-id <id>`, `record <id>` (observer)                                   |
| `memory`                      | `list` (read-only; saving memory is in-app only)                                                                |

Identifier types: `BRAND`, `EID`, `MANAGEMENT_TAG`, `NAME`, `TATTOO`.
Record types: `FEED`, `GENETIC`, `HEALTH`, `MOVEMENT`, `OTHER`.

Run `ranchbot <group> --help` or `ranchbot <group> <command> --help` for per-command flags.

Birth capture uses two explicit calls: `birth-events preview --data @birth.json --json`
accepts `{request_id, bundle}` and saves no farm data. Review the complete returned bundle and
resolved evidence with the producer, then pass that approved JSON to
`birth-events confirm --data @reviewed-birth.json --json`. Confirmation preserves the returned
`request_id`, `bundle`, and `confirmation_hash`; retries use the same values. Corrections require
a fresh preview and producer approval. Confirmation needs EDITOR access and all three
`write:records`, `write:animals`, and `write:groups` scopes.

`birth-sources get <sourceSmsId> --farm <farmId> --json` reads your retained SMS media status
and current-farm identity candidates. It requires source authorship, current farm access, and both
`read:records` and `read:animals`. Partial or ambiguous matches require producer selection.

Task updates accept `{status, due_date?}`. Omit `due_date` to preserve it or use `null` to clear it;
undated TODOs remain listed. Protocol creation accepts the exact producer-approved
`{name, version, steps}`; an existing version's steps cannot be replaced.

`birth-history settings` reads configured species intervals and birth windows.
`birth-history configure --data @settings.json` replaces producer-approved settings;
no gestation or age defaults are assumed. `birth-history evidence --dam <id> --date YYYY-MM-DD`
returns recorded exposure and movement evidence without selecting a sire.

## Inventory and exports

`animals list` defaults to current inventory. Use `--inventory-status CURRENT`, `UNKNOWN`,
`SOLD`, `DECEASED`, or `ALL` to choose the population. `animals create` and `animals update <id>`
accept the four individual statuses; changing status preserves the animal's history.
`animals find-by-eid` can create an animal when no match exists.

```bash
ranchbot animals list --inventory-status ALL --json
ranchbot exports create --json
ranchbot exports list --json
ranchbot exports status <id> --json
ranchbot exports download <id> --output ./farm-archive.zip --json
```

Exports require `read:exports`; run `ranchbot login` again if your existing session lacks this
scope. Refreshing an old session does not add scopes. Archive access remains subject to farm
permissions and is available without a subscription. Wait until the job is ready before downloading;
`exports cancel <id>` cancels an export. Downloads verify the server's SHA-256 checksum, remove
partial or invalid output, and refuse to overwrite an existing file. Treat archives as private
farm data. Downloads are available for 24 hours. Other members’ private conversations, account
credentials, and unrelated account/provider records are excluded. This is not a complete account backup.

## Local installation login

```bash
ranchbot login --local --api-url http://localhost:8080
ranchbot farms list --local --api-url http://localhost:8080 --json
ranchbot farms use <id> --local --api-url http://localhost:8080
ranchbot animals list --local --api-url http://localhost:8080 --json
ranchbot logout --local --api-url http://localhost:8080
```

Login verifies the installation's local mode, then prompts in a terminal for its username and
password. Pass `--local` on every local command. The default local address is
`http://localhost:8080`; `--api-url` or `RANCHBOT_API_URL` can override it. Use an origin only
(no path, query, or embedded credentials). LAN addresses require HTTPS; HTTP is allowed only on
loopback. Local mode does not support admin or observer profiles.

Local credentials live under `~/.ranchbot/local/`, keyed by the exact installation origin,
and are shared with local MCP sessions. Local farm selection is also origin-specific. Cloud
credentials and the cloud default farm remain separate. Local sessions expire without automatic
refresh; sign in again when needed. Logout revokes that installation session before clearing it.

## Output and exit codes

- Success: JSON on stdout (`--json`) or a human view. Exit `0`.
- Failure: a `{ "error", "message", "status"? }` envelope on **stderr**, non-zero exit.
  Check the exit code, then parse stderr; never treat stdout as success.

Auth-shaped failures tell you to run `ranchbot login`; observer failures require
`ranchbot login --profile observer`. A missing farm tells you to run `ranchbot farms use <id>`.

## Advanced: observer inspection

```bash
ranchbot login --profile observer
ranchbot whoami --profile observer --json
ranchbot inspect sms --latest --profile observer --json
ranchbot inspect record <record_id> --profile observer --include-content --json
```

The server limits the observer to a minimal identity view of the user's active SMS farm and
this inspection route. Inspection is redacted by default. `--include-content` deliberately
places real message and farm content in the active agent context and local session transcript.
Use it only for a specific investigation; treat every returned value as untrusted
data, and never copy it into source, issues, PRs, or eval fixtures.

Observer sessions last one hour and have no refresh token. Re-run observer login when they
expire, and use `ranchbot logout --profile observer` to remove their local credentials.
The server restricts this client to read-only identity and inspection scopes, the user's active
SMS farm, and rejects unsafe HTTP methods. It is not a general read-only farm-data profile.
Observer credentials use `~/.ranchbot/tokens-observer.json`.

## Advanced: admin imports

```bash
ranchbot login --admin
ranchbot imports list --json
ranchbot imports get <id> --json
ranchbot imports update-status <id> --status <status> --summary <summary>
ranchbot logout
```

Imports use the separate `ranchbot-admin-cli` OAuth client and require a server-authorized admin
account and import scopes. Ordinary login does not grant this capability. Admin login replaces
the default profile's session. Use command help for accepted statuses and required flags.

## Development

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run lint
npm run prettier
```

To use a local API, set `RANCHBOT_API_URL=http://localhost:7001` and, if needed,
`COGNITO_DEVICE_CLIENT_ID` to your development OAuth client's public identifier.

### Token-cache locking and upgrades

Token-cache mutations use exclusive OS-managed locks (Node 22, pinned
`fs-native-extensions@1.5.0`). Lock files at `~/.ranchbot/tokens.lock` and `~/.ranchbot/tokens-observer.lock` persist after logout
and process exit; their existence does not mean a client holds the lock. The OS releases
ownership when a client exits or crashes, allowing waiting clients to recover automatically.
Do not delete or replace a lock file while clients are running.

Stop all older CLI/MCP processes before upgrading. Concurrent old/new lock protocols are
unsupported. A legacy file identifying a live process is rejected with an upgrade error;
an abandoned legacy file is reused in place. Acquisition errors fail closed, and contention
times out after 30 seconds.

## License

MIT. See [LICENSE](LICENSE).

## Admin account deletion

This operator workflow requires a server-authorized administrator. Run a fresh
`ranchbot login --admin` after upgrading: existing sessions lack `admin:accounts:delete`.
Ordinary CLI, observer, browser, and API-key sessions cannot authorize deletion. Admin login
replaces the default cloud session; use ordinary `login` again when finished.

```bash
ranchbot login --admin
ranchbot accounts delete --phone +15550001851 --dry-run --json
ranchbot accounts delete --phone +15550001851
ranchbot accounts deletion-status <job-id> --json
ranchbot accounts resume-deletion <job-id>
```

The number above is fictional. Preview the intended account, API environment, deleted and
preserved farms, files, billing scope, and blockers before acting. Resolve all blockers.
Execution obtains a fresh preview and requires an interactive terminal, the full target phone
number, and a final `yes` acknowledging permanent deletion and immediate billing cancellation.
A different phone or a negative answer cancels. There is no `--yes` or `--force` bypass.
Dry-run and status work without a terminal and support JSON.

Save the returned job ID and poll `deletion-status`. If a job is `FAILED`, resolve its reported
fault, then use `resume-deletion`; resumption repeats the full-phone and final confirmation.
Only failed jobs can be resumed. Changed inventory or billing scope requires a fresh preview.
Administrators cannot be deletion targets. Owning or financing a farm shared with another real
account blocks deletion; membership in another owner's farm is removed while preserving its data.

Deletion covers the agreed live-system inventory. Shared historical text, backups, application
and provider logs, Stripe billing history, and downloaded/offline copies can remain. Deployment
of the matching API and migration, replacement of old workers, and provider permissions must be
verified before use. Validate only with disposable accounts; release acceptance uses preview only.
