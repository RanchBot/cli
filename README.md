# Ranch.Bot CLI

Read and manage Ranch.Bot farm data from your terminal or an agent harness.
Requires Node.js 22+ and a Ranch.Bot account with access to a farm.

## Install

```bash
npm install -g @ranchbot/cli@1.0.0
ranchbot --version
ranchbot --help
```

Or run without a global installation:

```bash
npx -y @ranchbot/cli@1.0.0 --help
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
The CLI does not enforce private agent approval procedures or ask for per-operation confirmation.
CLI writes do not pass through the app review screen or its Action-backed Change History.
Review write commands before running them or allowing an agent to execute them.

Credentials are stored at `~/.ranchbot/tokens.json`; the selected farm is stored at
`~/.ranchbot/config.json`. These are separate from the MCP server cache at
`~/.ranchbot-mcp-tokens.json`. Treat credential files as secrets; do not print or share them.

## Shared command flags

Every leaf command accepts these flags (place them after the leaf command, as in the examples):

| Flag | Purpose |
| --- | --- |
| `-j, --json` | Machine-readable JSON on stdout (agents always set this). |
| `--farm <id>` | Use this farm for one command (overrides the default). |
| `--api-url <url>` / `--api-version <v>` / `--client-id <id>` | Overrides; rarely needed. `--client-id` cannot replace the observer client. |
| `--profile <name>` | Credential profile: `default` or read-only `observer`. |

Complex payloads (`--data`) accept inline JSON, `@file.json`, or `-` (stdin).

## Commands

| Group | Commands |
| --- | --- |
| `login` / `logout` / `whoami` | OAuth device flow, sign out, session + farm status. |
| `farms` | `list`, `get <id>`, `use <id>` |
| `animals` | `list`, `get <id>`, `create`, `update <id>`, `delete <id>`, `find-by-eid <eid>` |
| `identifiers` | `list <animal_id>`, `add <animal_id> --type --value [--primary]`, `remove <animal_id> <id>` |
| `groups` | `list`, `get <id>`, `create --name [--description]`, `update <id>`, `delete <id>` |
| `records` | `list [--type]`, `get <id>`, `create --name --type --applied-at --animal/--group`, `update <id>`, `delete <id>` |
| `chute` | `list [--status]`, `get <id>`, `create --data <widgets>`, `update <id> --data <widgets>` (propose only) |
| `rations` | `list [--include-inactive]`, `get <id>`, `create --data <ration>` (structure only) |
| `feedings` | `list [--status] [--since]`, `get <id>` (read-only) |
| `memory` | `list` (read-only; saving memory is in-app only) |

Identifier types: `BRAND`, `EID`, `MANAGEMENT_TAG`, `NAME`, `TATTOO`.
Record types: `FEED`, `GENETIC`, `HEALTH`, `MOVEMENT`, `OTHER`.

Run `ranchbot <group> --help` or `ranchbot <group> <command> --help` for per-command flags.

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
