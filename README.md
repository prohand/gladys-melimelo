# Melimelo — Gladys Assistant integration

External integration connecting [Gladys Assistant](https://gladysassistant.com) to
[Melimelo](https://melimelo.co), the household organizer: tasks, shopping list, bin
collection days, birthdays and the household calendar, in Gladys devices, scenes and on the
dashboard.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
Requires **Gladys 5.3.0 or later**. Transport: **cloud** only.

User documentation: [English](./docs/en.md) · [Français](./docs/fr.md) ·
[Deutsch](./docs/de.md) · [Español](./docs/es.md).

> **Status — waiting for a Melimelo API.** Melimelo does not publish a public API yet. The
> integration talks to the API described in [Melimelo API contract](#melimelo-api-contract)
> below, configured with a URL and a personal access token. Every route lives in one file,
> [`src/melimelo/client.js`](./src/melimelo/client.js): aligning it with the real API, once
> Melimelo opens one, touches that file only.

## What it does

| Surface                    | Content                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Device (one per household) | Open tasks, overdue tasks, shopping items, today's events, next bin collection (days + name), next birthday (days + name) |
| Scene triggers             | `task_due`, `garbage_collection_tomorrow`, `birthday_today`, `shopping_item_added`, `event_starting_soon`                 |
| Scene actions              | `add_shopping_item`, `create_task`, `complete_task`, `sync_now`                                                           |
| Dashboard widget           | `household`: 3 tiles, a list (tasks / shopping / agenda / bin days), a status block, an "Add to shopping" form            |
| Configuration buttons      | `test_connection`, `sync_now`                                                                                             |

### How it works

- **Polling, on its own timer.** Melimelo pushes nothing: `src/melimelo/sync.js` reads it every
  `sync_interval` seconds (5 min by default). The household device is published with
  `should_poll: false` — the triggers must fire even before the user creates the device.
- **Only what changed** is published (`publishChangedStates`, 30-minute heartbeat).
- **Triggers are deduced** from two successive snapshots and from the calendar. A date-based
  trigger fires **once** per occurrence: its key is kept in `/data/fired-triggers.json` for 45
  days, so a restart does not fire it again.
- **No loops**: an item added by Gladys (scene action, widget form) is never announced back as
  `shopping_item_added`.
- **Days are counted in the household time zone** (`timezone` setting), not in the container's
  UTC.

## Melimelo API contract

What the client expects, JSON over HTTPS, `Authorization: Bearer <token>` on every request.
The normalizers accept a bare list or a `{ data | items | results: [...] }` envelope, and the
usual field aliases (`title`/`name`, `due_date`/`dueDate`, `start`/`start_at`…).

| Method | Route                                      | Answer / body                                       |
| ------ | ------------------------------------------ | --------------------------------------------------- |
| GET    | `/household`                               | `{ id, name }`                                      |
| GET    | `/tasks?status=open`                       | `[{ id, title, due_date?, assignee?, done? }]`      |
| POST   | `/tasks`                                   | body `{ title, due_date? }` → `{ id }`              |
| POST   | `/tasks/{id}/complete`                     | `204`                                               |
| GET    | `/shopping-list/items`                     | `[{ id, name, quantity?, added_by?, checked? }]`    |
| POST   | `/shopping-list/items`                     | body `{ name, quantity? }` → `{ id }`               |
| GET    | `/garbage-collections?from=YYYY-MM-DD&to=` | `[{ date, type, label? }]` (`type` in any language) |
| GET    | `/birthdays`                               | `[{ name, date }]` (birth date or next occurrence)  |
| GET    | `/events?from=ISO&to=ISO`                  | `[{ id, title, start, all_day?, location? }]`       |

Errors: `401`/`403` → "token refused", `404` → "check the URL", `429` → "slow down", `5xx`
→ "try again later". The token never appears in a URL, a message or a log line, redirects are
refused (`redirect: 'error'`), and only `https` URLs are accepted (`http` on the loopback only,
for development).

## Project structure

```
.
├─ index.js                          # SDK bootstrap (real GladysIntegration + /data)
├─ src/
│  ├─ app.js                         # every handler, wired on a Gladys instance (tested with the fake one)
│  ├─ config.js                      # defaults, bounds, https-only API URL
│  ├─ i18n.js                        # en, fr, de, es
│  ├─ messages.js                    # user-facing messages (connection status, toasts, reports)
│  ├─ time.js                        # calendar days in the household time zone
│  ├─ melimelo/
│  │  ├─ client.js                   #   the Melimelo API client — the API contract lives here
│  │  ├─ sync.js                     #   the synchronization loop (states, triggers, widget nudge)
│  │  ├─ summary.js                  #   the figures of a snapshot
│  │  └─ firedStore.js               #   date-based triggers already fired, kept in /data
│  ├─ devices/
│  │  └─ household.js                #   the household device and its states
│  └─ capabilities/                  # Gladys 5.1+: scenes and dashboard
│     ├─ triggers.js                 #   scene triggers
│     ├─ scenes.js                   #   scene actions
│     └─ widget.js                   #   the "Melimelo household" widget
├─ docs/                             # user documentation (en, fr, de, es), re-hosted by Gladys
├─ test/                             # node --test, fake Gladys (SDK) + fake Melimelo API
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
└─ .github/                          # CI, UI-driven release, multi-arch build, GitHub releases, Dependabot
```

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="melimelo" \
MELIMELO_DATA_DIR=/tmp/gladys-melimelo \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` variables are injected by the Gladys supervisor in the container; the SDK
reads them itself. `MELIMELO_DATA_DIR` (default `/data`) is where the fired triggers are kept.

## Quality checks

The same checks run on every push and pull request (see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)), on Node 22 and 24, plus the store
admission checks and a Docker build on pull requests:

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test
```

Before tagging a release, the store validation can be run locally:

```bash
npx github:GladysAssistant/integration-store .
```

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md), then
**Actions → Release → Run workflow** and pick `patch`, `minor` or `major`. The workflow bumps
the version everywhere (`package.json` + manifest `version`/`docker_image`), rolls the
changelog, pushes the `vX.Y.Z` tag, builds the `linux/amd64` + `linux/arm64` image to
`ghcr.io`, publishes the GitHub Release, then runs the store checks on the released image. The
decentralized indexer picks up the new version — the repository must be public and carry the
`gladys-assistant-integration` GitHub topic.

## Credits

Melimelo is a product of its own authors; this project is not affiliated with Melimelo.

## License

Apache-2.0
