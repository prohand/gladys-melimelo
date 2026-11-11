# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for **Melimelo** (https://melimelo.co), a
household organizer: tasks, shopping list, bin collection days, birthdays, calendar. Requires
Gladys 5.3+. Transport: **cloud only** (`"transports": ["cloud"]`).

Melimelo publishes **no public API yet**. The integration targets the contract documented in
the README ("Melimelo API contract"); every route is in `ROUTES` of
`src/melimelo/client.js`. Never reverse-engineer the Melimelo app to find its private backend:
align `client.js` with the official API when there is one.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/triggers.test.js           # one file
node --test --test-name-pattern "birthday"  # one test by name
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store --skip-image-check .   # store admission checks
```

CI runs `format:check`, `lint`, `test` (Node 22 and 24), plus the store checks and a Docker
build on pull requests. Releases: **Actions → Release** only (bumps `package.json`, manifest
`version` + `docker_image`, rolls `CHANGELOG.md`, tags, builds, publishes the GitHub Release).

## Architecture

```
index.js                    SDK bootstrap only (real GladysIntegration, /data path, user agent)
src/app.js                  registerHandlers(gladys): every handler; tests drive it with createFakeGladys
src/config.js               defaults (= manifest defaults), bounds, https-only API URL
src/time.js                 calendar days in the household time zone
src/messages.js             user-facing { en, fr, de, es } messages
src/i18n.js                 LANGUAGES, pick, localize
src/melimelo/client.js      HTTP client + tolerant normalizers; the API contract
src/melimelo/sync.js        the loop: snapshot -> device, changed states, triggers, widget nudge, status
src/melimelo/summary.js     figures of a snapshot (shared by device, widget, test report)
src/melimelo/firedStore.js  date-based triggers already fired, /data/fired-triggers.json, 45 days
src/devices/household.js    the household device (read-only features) and its states
src/capabilities/           Gladys 5.1+: triggers.js, scenes.js, widget.js
```

### Invariants worth knowing

- **Own timer, no Gladys polling**: the device is published with `should_poll: false`; the sync
  loop runs every `sync_interval` seconds whether or not the user created the device.
- **One sync at a time**: `sync.sync()` returns the running one instead of starting another.
- **Triggers fire once** per occurrence (`once` keys in the fired store); `shopping_item_added`
  diffs two snapshots, the first one is a baseline. At most 30 events per sync (core limit 300/min).
- **No loops**: items added by Gladys (`sync.rememberOwnItem`) never fire `shopping_item_added`.
- **The token is a secret**: Authorization header only; never in a URL, an error, a log line or
  anything sent to Gladys (tested). Redirects are refused; only https URLs (http on loopback).
- **Days are local**: compare `YYYY-MM-DD` strings computed in `config.timezone`, never UTC.
- **Every feature declares `min`/`max`** (NOT NULL in Gladys).
- **Widget budget**: ≤ 8 components, 1 focal, 6 tiles, 1 status, 4 buttons — checked with
  `validateWidgetContent` in `test/app.test.js`.
- Trigger, action, widget, feature and output keys are stored by users: **never rename them**.

### Manifest

`test/manifest.test.js` keeps `gladys-assistant-integration.json` in sync with the code:
`DEFAULT_CONFIG`, action handlers, trigger data keys (`TRIGGER_DATA_KEYS`), action outputs
(`SCENE_ACTION_OUTPUTS`), widget lists, categories vocabulary, keywords rules,
`gladys_version >=5.3.0`, `transports: ["cloud"]`, and `{ en, fr, de, es }` on every text.

## Testing

No network: `test/helpers/fakeMelimelo.js` serves the API contract through an injected `fetch`;
`createFakeGladys()` from `@gladysassistant/integration-sdk/testing` plays Gladys (and refuses
what the host API refuses).

## Conventions

Prettier formats, ESLint catches mistakes. Comments explain **why**. User-facing text is
`{ en, fr, de, es }`; user docs in `docs/en.md`, `docs/fr.md`, `docs/de.md`, `docs/es.md`, kept
in sync (the manifest test checks they name every trigger and action). Note every user-visible
change under `## [Unreleased]` in `CHANGELOG.md`.
