# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ioBroker adapter (`iobroker.awtrix-ng`) that controls an [Awtrix NG](https://github.com/Blueforcer/awtrix-ng) pixel clock (e.g. Ulanzi TC001) over its HTTP API. TypeScript sources in `src/`, compiled to `build/`. Node >= 22.

## Commands

```bash
npm run build          # compile src/ -> build/ (build-adapter ts, cleans build/ first)
npm run watch          # incremental build
npm run check          # tsc --noEmit type check
npm run lint           # eslint (@iobroker/eslint-config), prettier config in prettier.config.mjs
npm test               # test:ts (mocha on src/**/*.test.ts) + test:package (io-package/package.json validation)
npm run test:integration   # @iobroker/testing integration test (starts a real js-controller; needs a build first)
npm run translate      # translate-adapter: fills i18n for admin/i18n and io-package.json
npm run release-patch  # @alcalzone/release-script (runs lint before, build before commit)
```

Single TS test file: `npx mocha --config test/mocharc.custom.json src/path/to/file.test.ts`. There are currently no real unit tests (`src/main.test.ts` is a placeholder).

`build/` is committed to git, but only updated by the release script (it rebuilds before its release commit). Run `npm run build` to verify changes, but roll back `build/` before committing (`git checkout -- build`) — normal commits must not contain changes in `build/`.

## Architecture

- **`src/main.ts`** — entry; exports the adapter factory for compact mode.
- **`src/awtrix-ng.ts`** — `AwtrixNg` adapter class (the bulk of the logic):
  - `onReady` creates the `AwtrixClient` and starts `refreshState()`, a 60 s poll of `GET device` that fills `meta.*`, `sensor.*`, `device.*`, `display.brightness`.
  - `setApiConnected(true)` (on transition offline → online) does the full resync: welcome notification, `refreshSettings()`, `createAppObjects()`, indicators 1–3, moodlight, optional screen-content download (RGB565 → SVG into `display.content`).
  - `onStateChange` (non-ack only) pushes writes to the device: `settings.*`, indicators, moodlight, etc.
  - `onMessage` handles `sendTo` commands: `notification`, `audio`, `sendNotification` (ioBroker notification-manager integration), `getBackgroundEffects`. `admin/blockly.js` generates Blockly blocks that call these.
- **HTTP API** — all device requests go through the npm package [`awtrix-ng-api`](https://www.npmjs.com/package/awtrix-ng-api) (`AwtrixClient`, namespaces `device`, `settings`, `display`, `apps`, `notifications`, `indicators`, `audio`, ...; payload/response types like `ClassicAppPayload`, `AppInfo`). Errors are `AwtrixApiError` (non-2xx) / `AwtrixConnectionError` (no answer); the adapter tracks the connection itself in `apiConnected` (set by the `GET device` poll) and logs poll errors via `logRequestError()`.
- **`src/lib/app-type/`** — one object per Awtrix app under the `apps.<nameClean>` channel:
  - `abstract.ts` `AbstractApp`: shared `enabled`/`slot`/`activate` states and handling. Each app instance registers its **own** `stateChange`/`objectChange` listeners on the adapter; subclasses override `stateChanged`/`objectChanged`/`refresh`/`init`.
  - `builtin.ts` (device built-in apps), `script.ts` (apps pushed to the device by others), `user.ts` `UserApp` (apps this adapter creates/owns; may delete them on stop via `removeAppsOnStop`).
  - `user/custom.ts` (text + state value with thresholds), `user/history.ts` (chart from a history adapter instance), `user/expert.ts` (fully state-driven app with many sub-states).
  - `createAppObjects()` fetches the device app list, instantiates the right class per app, creates/extends objects, deletes `apps.*` channels no longer present, then `PUT apps/order` from enabled apps sorted by slot.
- **Settings mapping** — the `settings.*` objects are declared statically in `io-package.json` `instanceObjects`; each state carries `native.settingsKey`, which maps it to a key in the flattened device `GET settings` response. To expose a new device setting, add an object with `settingsKey` there (no code change needed). Naming: `settings.<group>.<settingsKey>` (the state name is the device key, nested keys like `weekdayBar.activeColor` get a `folder`). Objects below `settings.*` that are no longer in `instanceObjects` are deleted on startup (`deleteObsoleteSettingsObjects`), so renaming is safe. Other static states (`meta.*`, `sensor.*`, ...) are also defined in `instanceObjects`.
- **`src/lib/audio/`** — audio sources of the device, only if supported (`capabilities.audio.radio` / `.mp3` / `.buzzer`). `AudioPlayer` (`player.ts`) is the shared base: one channel per item under `<channel>.<item>` with a switch `playing`, global `playing` / current / `stop` states, items synced (created / deleted) with the device. `Radio` (`audio.radio`, stations from `audio.getState()`), `Mp3` (`audio.mp3`, files from `audio.listMp3()`) and `Melody` (`audio.melody`, `audio.listMelodies()`, capability `buzzer`; no playback state reported by the device → `currentStateId = null` gives items a button `play` instead of a switch `playing`). Refreshed in the resync step `audio` and in every 60 s poll (one shared `getState()` call). Items are maintained on the device only.
- **Foreign settings instance** — if `config.foreignSettingsInstance` points to another instance, this instance is not the "main" instance: it copies app config (`customApps`, `historyApps`, `expertApps`, ...) from that instance's `native` and reads app `enabled`/`slot` states from the foreign namespace (`objPrefix` in `AbstractApp`). This lets multiple clocks share one app configuration.
- **Config** — `admin/jsonConfig.json` (admin UI), types in `src/lib/adapter-config.d.ts` (keep both in sync with `native` defaults in `io-package.json`).

## Conventions

- `AwtrixNg.supportedVersion` holds the recommended firmware version; when bumping it, also update README changelog and `docs/{en,de}/README.md`.
- Changelog entries go under `### **WORK IN PROGRESS**` in `README.md` in the format `* (@klein0r) ...`; the release script moves them.
- User documentation lives in `docs/en/README.md` and `docs/de/README.md` — update both.
- Translatable strings (object names in `io-package.json`, `admin/i18n/*.json`, Blockly words) are objects keyed by language (en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn).
