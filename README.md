# Self-Healing Test Automation Factory

Portfolio demo for a recorder-driven QA automation workflow.

The project currently ships **Lane A - Manual QC Assistant** as an MVP: a Chrome extension that records manual tester actions, replays them, runs CSV data loops, combines reusable flows into suites, and exports JSON/HTML reports.

Lane B - AI Automation Factory is planned next. It will consume exported action logs to generate Playwright tests, validate runtime behavior, and support selector self-healing.

## What Is Implemented

- Local demo shop served by Express.
- Chrome Manifest V3 extension.
- Record readable manual QA steps.
- Capture selector candidates:
  - `data-testid`
  - `id`
  - role/text
  - CSS
  - XPath
- Replay step, group, full flow, and suite.
- Record/replay common controls:
  - text input
  - textarea
  - dropdown/select
  - radio
  - checkbox
- CSV data loop with column binding.
- Visual Suite Builder with drag/drop order.
- Background Suite runner so multi-flow suite execution can continue outside popup lifecycle.
- JSON/HTML report export with failure screenshot when available.
- Action log JSON contract for future Playwright generation and self-healing.

## Quick Start

Install dependencies:

```powershell
npm install
```

Run the local demo app:

```powershell
npm start
```

Open:

```text
http://localhost:4173
```

## Load The Chrome Extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select:

```text
extension/
```

See [extension/README.md](extension/README.md) for detailed extension usage.

## Main Demo Flow

1. Open the demo shop.
2. Open the extension popup.
3. In `Record`, click `Start`.
4. Perform login, add-to-cart, cart, checkout, and confirmation.
5. Click `Stop`.
6. Review readable steps.
7. Use `Replay`, `Data`, `Suite`, or `Report` tabs.
8. Click `Download` to export a portable action-log JSON.

## Project Structure

```text
extension/   Chrome extension recorder/replay/suite UI
public/      Local demo shop frontend
src/app/     Express demo server
src/agents/  Lane B agent/generator scaffolding
context/     Architecture and action-log contract context
agents/      Agent role definitions
skills/      Skill/context notes for future agents
docs/        Verification checklist
logs/        Local saved action logs for demo/dev use
samples/     CSV sample data
tests/       Generated Playwright test sample
```

## Action Log Contract

Exported action logs are the main contract between Lane A and Lane B.

Lane B should consume exported action logs, not Chrome popup state or `chrome.storage.local`.

The contract contains:

- `metadata`
- `session`
- `testCase`
- `groups`
- `actions`
- `datasets`
- `bindings`
- `runPolicy`

See [context/action-log-schema.md](context/action-log-schema.md).

## Useful Commands

```powershell
npm start
npm run generate:test
npm run test:e2e
```

## Current Status

- Lane A Manual QC Assistant: MVP complete.
- Lane B AI Automation Factory: future/next lane.
- Portable demo package: future.
- Suite CSV: intentionally hidden from MVP until the data ownership/mapping design is clearer.

## Notes

- The extension is the primary recorder.
- The Playwright scripted recorder is only a helper/fixture path.
- `Download` creates portable action logs.
- `Save Local` writes only to the current project folder under `logs/`.
- Do not use this demo against unauthorized third-party websites.
