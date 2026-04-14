# loombot

A self-hostable Telegram community bot you can spin up by editing a single YAML file. Chat admins
customize their own chat via an inline `/config` menu — no web UI, no Pubky identity required to run
it.

- **One file configures the bot.** `config.yaml` lists every feature with sensible defaults. Chat
  admins toggle features per-chat via `/config`.
- **Sandboxed services.** Each feature (help, meetups, triggerwords, url cleaner, event creator, …)
  runs in a Deno subprocess with zero permissions by default.
- **Optional Pubky.** Features that publish events to a Pubky homeserver are auto-disabled unless
  you provide a keypair. Everything else runs without it.
- **Pre-built profiles.** `configs/general-purpose.example.yaml` for anyone,
  `configs/dezentralschweiz.example.yaml` for the Swiss bitcoin community.

---

## Quick start

### Docker (recommended for self-hosting)

```bash
mkdir loombot && cd loombot
curl -O https://raw.githubusercontent.com/gillohner/loombot/master/docker-compose.yml

cat > .env <<EOF
BOT_TOKEN=123456:your-telegram-bot-token
PROFILE=general-purpose
BOT_ADMIN_IDS=your_telegram_user_id
EOF

docker compose up -d
```

That's it — the container copies a profile on first boot, writes `config.yaml` into the
`loombot_data` volume, and starts polling. See [Docker](#docker) below for the full env-var
reference, the dezentralschweiz profile, and Pubky setup.

### From source

```bash
git clone https://github.com/gillohner/loombot
cd loombot

cp configs/general-purpose.example.yaml config.yaml
cp .env.example .env.local

# Put your BOT_TOKEN into .env.local, then:
deno task config:check
deno task dev
```

Invite the bot to your Telegram group. As a chat admin, run `/config` to pick which features are
active in that chat.

---

## Prerequisites

- [Deno](https://deno.com) 1.45+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- _(Optional)_ A [Pubky](https://pubky.org) identity if you want the `event_creator` feature or any
  other service that writes to a homeserver

---

## How configuration works

Three layers, merged at dispatch time:

```
config.yaml (operator defaults)
        │
        ▼
chat-type default    ← `dms:` / `groups:` fields per feature
        │
        ▼
chat override        ← what chat admins set via /config (in SQLite)
        │
        ▼
resolved snapshot    ← what the dispatcher actually runs
```

Each entry under `features:` is a command or listener the bot exposes. Its shape:

```yaml
features:
  meetups:
    service: meetups # name from src/services/registry.ts
    groups: true # enabled by default in groups
    dms: true # enabled by default in DMs
    lock: false # true = chat admins can't toggle it
    config: { … } # passed to the service as serviceConfig
    datasets: { … } # passed as datasets (optional)
    allow_external_calendars: true # meetups-specific
```

The **feature id** (the key above, e.g. `meetups`) is also the command name for command-style
services. Duplicate service instances with different ids are allowed — the Dezentralschweiz profile
has three triggerwords features (`pocketethereum`, `shitcoin_alarm`, `shitcoiner_alarm`) each with
its own trigger list.

---

## Setup

### 1. Configure

```bash
cp configs/general-purpose.example.yaml config.yaml   # or another profile
cp .env.example .env.local
```

Edit `config.yaml` — walk through each feature, set sensible defaults. For `meetups` add the
calendar URIs you want chat admins to be able to pick from. For `pubky.enabled: true` profiles, fill
in `recovery_file` and `approval_group_chat_id`.

Edit `.env.local` and set `BOT_TOKEN`. If `pubky.enabled: true`, also set `PUBKY_PASSPHRASE`.

Validate the config without starting the bot:

```bash
deno task config:check
# or validate a profile in-place:
deno task config:check ./configs/dezentralschweiz.example.yaml
```

### 2. Run

```bash
deno task dev     # polling mode, auto-reloads on file change
deno task serve   # webhook mode (WEBHOOK=1 set by the task)
```

### 3. Register commands

Invite the bot into a Telegram group, make it admin, send `/start`. The bot registers the command
list automatically and again on every `/config` use.

---

## Per-chat configuration (for chat admins)

Chat admins (Telegram admins, or users listed in `bot.admin_ids`) run `/config` in the chat and get
an inline-keyboard menu:

- **🧩 Features** — toggle which features are on in this chat. Locked features (`lock: true` in
  `config.yaml`) don't appear.
- **📅 Calendars** — pick which operator-curated meetup calendars to show in this chat. If the
  operator set `allow_external_calendars: true`, admins can also add a freeform
  `pubky://…/calendars/…` URI.
- **👋 Welcome message** — override the default new-member greeting for this chat only. Supports
  `{display_name}`, `{username}`, `{first_name}`, `{last_name}`, `{user_id}` placeholders.

Per-chat settings live in the local SQLite database (`bot.sqlite`). They persist across restarts but
are not shared between deployments — each host has its own overrides.

---

## Profiles

Pre-built configs in `configs/`:

- **`general-purpose.example.yaml`** — `pubky.enabled: false`. Ships with `help`, `hello`, `meetups`
  (off until you add calendars or flip `allow_external_calendars`), `new_member`, `triggerwords`
  (uses the service's built-in eth/btc joke dataset), `url_cleaner` (built-in alt-frontend
  mappings). Works with just a `BOT_TOKEN`.

- **`dezentralschweiz.example.yaml`** — The Swiss bitcoin community bot. `pubky.enabled: true`, two
  curated calendars, German welcome messages, `/meetup_erstellen` event creator, full `/links`
  category list, and three triggerwords listeners (pocketethereum, shitcoin alarm, shitcoiner alarm)
  with all responses and trigger words inlined. Requires a Pubky recovery file to enable event
  publishing.

Copy either to `config.yaml` as your starting point.

---

## Docker

The container ships as a single image that picks one of the bundled profiles on first boot and
layers env-var overrides on top. No file editing required for a vanilla install.

### Minimal `.env`

```dotenv
BOT_TOKEN=123456:your-telegram-bot-token
PROFILE=general-purpose        # or: minimal | dezentralschweiz
BOT_ADMIN_IDS=12345678         # comma-separated Telegram user ids
```

Then `docker compose up -d` using the `docker-compose.yml` at the repo root.

### Persistent data

One named volume (`loombot_data`) maps to `/data` inside the container:

```
/data/
├── config.yaml     # copied from configs/${PROFILE}.example.yaml on first boot
├── bot.sqlite      # per-chat overrides + pending pubky writes
└── secrets/
    └── operator.pkarr   # optional pubky recovery file
```

The profile copy only happens when `config.yaml` is missing, so editing it in the volume survives
restarts. If you prefer editing on the host, swap the named volume for a bind mount in
`docker-compose.yml`:

```yaml
volumes:
  - ./data:/data
```

### Environment variables

| Variable                       | Purpose                                                                  | Default                        |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------ |
| `BOT_TOKEN`                    | Telegram bot token from @BotFather                                       | **required**                   |
| `PROFILE`                      | Which profile to copy on first boot                                      | `general-purpose`              |
| `BOT_ADMIN_IDS`                | Comma-separated Telegram user ids (super-admins everywhere)              | empty                          |
| `LOCK_DM_CONFIG`               | `1` → only super-admins can `/config` in DMs                             | `0`                            |
| `LOG_MIN_LEVEL`                | `debug` / `info` / `warn` / `error`                                      | `info`                         |
| `PUBKY_ENABLED`                | `1` → enable the Pubky writer                                            | `0`                            |
| `PUBKY_PASSPHRASE`             | Passphrase for the pkarr recovery file                                   | empty                          |
| `PUBKY_APPROVAL_GROUP_CHAT_ID` | Telegram chat id for write approvals                                     | unset                          |
| `PUBKY_APPROVAL_TIMEOUT_HOURS` | Hours before pending writes expire                                       | `24`                           |
| `PUBKY_RECOVERY_FILE`          | Path to `.pkarr` file inside the container                               | `/data/secrets/operator.pkarr` |
| `PUBKY_RECOVERY_FILE_B64`      | Base64-encoded `.pkarr` — written to `PUBKY_RECOVERY_FILE` on first boot | unset                          |

All env vars except `BOT_TOKEN` and `PUBKY_PASSPHRASE` are applied as overrides on top of whatever
is in `config.yaml` every boot, so you can swap admin ids or toggle Pubky without editing files.

Content-heavy fields — trigger words, link categories, curated calendars — stay in `config.yaml`
inside the volume. Either pre-seed it by copying a profile locally and mounting it, or shell in and
edit:

```bash
docker exec -it loombot sh -c 'vi /data/config.yaml'
docker compose restart loombot
```

### Profiles

- `general-purpose` (default) — works with just a `BOT_TOKEN`. No Pubky writing, built-in joke +
  alt-frontend datasets.
- `dezentralschweiz` — full Swiss bitcoin community bot. Set `PUBKY_ENABLED=1`, supply a recovery
  file, and set `PUBKY_APPROVAL_GROUP_CHAT_ID`.
- `minimal` — the tiny top-level `config.example.yaml`, useful as a start-from-scratch skeleton.

### Supplying a Pubky recovery file

Two options for `dezentralschweiz` or any `PUBKY_ENABLED=1` setup:

**File mount** (easiest when you control the filesystem):

```yaml
volumes:
  - ./loombot-data:/data
# then place your file at ./loombot-data/secrets/operator.pkarr on the host
```

**Base64 env var** (for platforms like Umbrel/Start9 where file mounts are awkward):

```bash
base64 -w0 ~/operator.pkarr   # copy the output
```

Paste into `.env`:

```dotenv
PUBKY_RECOVERY_FILE_B64=<base64 blob>
```

The entrypoint writes it to `/data/secrets/operator.pkarr` with `chmod 600` on first boot only;
thereafter it's ignored so rotating means deleting the volume file first.

### Self-hosted platforms (Umbrel / Start9 / TrueNAS)

The same image + compose file works under any platform that speaks Docker Compose. Each platform
provides its own manifest format that wraps a compose file and exposes env vars as a setup form:

- **Umbrel** — create an `umbrel-app.yml` beside the compose file listing the env vars. Umbrel
  renders a form and persists the values across restarts. See
  [Umbrel app docs](https://github.com/getumbrel/umbrel-apps).
- **Start9 / StartOS** — build an `s9pk` package whose manifest declares the same env vars as
  structured config fields. StartOS renders a proper form and injects them into the container.
- **TrueNAS Apps** — use "Custom App" → Docker Compose and paste the contents of
  `docker-compose.yml`. TrueNAS will prompt for the env vars defined in the compose file.

The source of truth in every case is `docker-compose.yml` at the repo root and the env-var table
above. Adding a platform manifest is ~20 lines of YAML per platform — contributions welcome.

---

## Secrets & key files

```
loombot/
├── config.yaml          # references ./secrets/<name>.pkarr
├── .env.local           # BOT_TOKEN, PUBKY_PASSPHRASE
└── secrets/
    └── operator.pkarr   # Pubky recovery file, chmod 600
```

- `secrets/` is gitignored — never commits.
- `.env.local` is gitignored — never commits.
- Passphrase stays in `.env.local` under `PUBKY_PASSPHRASE`; the config file only stores the path
  (`pubky.recovery_file`) and the env var name (`pubky.passphrase_env`, default `PUBKY_PASSPHRASE`).
- On servers, `chmod 600 secrets/*.pkarr` and run the bot as a dedicated user. In Docker, mount
  `./secrets` as a read-only volume and inject `PUBKY_PASSPHRASE` via the orchestrator's secret
  manager instead of committing `.env.local` into the image.

Generate a Pubky recovery file with [Pubky Ring](https://pubky.org) or the Pubky CLI; register it
with a homeserver before starting the bot.

---

## Operator admin

Super-admins (users in `bot.admin_ids`) can run `/config` anywhere, including DMs. Everyone else
defers to Telegram's chat-admin status for their group.

```yaml
bot:
  admin_ids: [123456789] # your Telegram user id(s)
  lock_dm_config: false # true = only super-admins can configure DMs
```

---

## Adding a new service

1. Create the service file at `packages/core_services/<name>/service.ts` using `defineService()`
   from `@sdk/mod.ts`.
2. Register it in `src/services/registry.ts` with its entry path and kind (`single_command` |
   `command_flow` | `listener`), plus any `net:` allow- list or `requiresPubky: true`.
3. Add a `features.<featureId>` block to `config.yaml` referencing the registry name.
4. Run `deno task config:check && deno task dev`.

Services talk to the bot via stdin/stdout JSON and return `ServiceResponse` objects — see
`packages/sdk/mod.ts` and any existing service for examples.

---

## Bundled services

| Service           | Kind           | Default command | Notes                                                     |
| ----------------- | -------------- | --------------- | --------------------------------------------------------- |
| `help`            | single_command | `/help`         | Configurable message + command list                       |
| `simple_response` | single_command | feature id      | One-line reply; run multiple for `/hello`, `/about`, etc. |
| `links`           | command_flow   | `/links`        | Categorized link menu with inline keyboard                |
| `meetups`         | command_flow   | `/meetups`      | Reads Pubky eventky calendars; today/week/2weeks/30days   |
| `event_creator`   | command_flow   | feature id      | Multi-step event creation → Pubky write (requires pubky)  |
| `new_member`      | listener       | —               | Welcomes new group members                                |
| `triggerwords`    | listener       | —               | Fires on keyword matches; multiple instances allowed      |
| `url_cleaner`     | listener       | —               | Strips trackers, suggests privacy-friendly alt frontends  |

---

## Troubleshooting

- **"Config file not found"** — copy an example to `config.yaml`, or set `CONFIG_FILE` in
  `.env.local`.
- **"unknown service"** — the `service:` value doesn't match anything in `src/services/registry.ts`.
  Typos are the usual cause.
- **Pubky-dependent features silently disabled** — check the `config.loaded` startup log: if
  `pubkyEnabled: false`, features with `requiresPubky: true` in the registry are filtered out. Flip
  `pubky.enabled: true` in `config.yaml` and set `PUBKY_PASSPHRASE` in `.env.local`.
- **Pubky writes fail** — confirm `recovery_file` path exists, the file is readable,
  `PUBKY_PASSPHRASE` decrypts it, and `approval_group_chat_id` points at a Telegram group the bot is
  in.
- **`/config` doesn't appear** — make sure you're a Telegram admin in the group, or that your user
  id is in `bot.admin_ids`.
- **Per-chat overrides not picked up** — snapshots auto-clear on restart, but for a running process
  you may need to wait up to 10 s for the in- memory cache to expire. `/config` actions invalidate
  the cache immediately.

---

## Deploy

Any process manager works. PM2 example:

```bash
pm2 start --name loombot "deno task serve"
pm2 save
```

On upgrade:

```bash
git pull
deno task config:check
pm2 restart loombot
```

The `bot.sqlite` file is the per-chat override database — back it up regularly if you care about
preserving chat admin customizations.

---

## Development

```bash
deno task dev         # polling mode with --watch
deno task test        # run all tests
deno task config:check
deno lint
deno fmt              # tabs, 100-char line width
```

Project layout and architecture notes live in `CLAUDE.md`.

---

## License

See `LICENSE` (TBD — loombot is a fork of
[loombot_core](https://github.com/gillohner/loombot_core)).
