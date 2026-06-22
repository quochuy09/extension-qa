# Self-Healing Test Automation Factory

> Portfolio project: Chrome Extension + Playwright pipeline for turning manual QA activity into reusable test assets.

## Why This Project Matters

Manual QA teams often lose valuable knowledge after each test run: the tester's actions, selector choices, data variations, replay result, and failure evidence stay scattered across notes, screenshots, or browser history.

This project solves that gap with a practical automation workflow:

1. A tester records a real business flow in the browser.
2. The Chrome extension converts it into readable manual test steps.
3. The same flow can be replayed, repeated with CSV data, combined into suites, and exported as a report.
4. The exported action log becomes a stable contract for generating Playwright automation.

The result is not just a recorder. It is a small QA automation factory that connects manual testing, test data, reporting, and generated Playwright code through one portable JSON contract.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Lane A - Manual QC Assistant | MVP complete | Chrome extension recorder, replay, CSV loop, suite runner, report export |
| Lane B - AI Automation Factory | MVP started | Action-log contract adapter, Playwright JavaScript + POM generation, reviewer loop, runtime validation |
| Self-healing selectors | Planned | Future work based on selector fallback data from the action log |
| Portable product package | Planned | Future packaging and production hardening |

## Key Features

### Chrome Extension Recorder

- Records real browser actions from the local demo application.
- Captures readable manual QA steps, not only low-level events.
- Supports common form controls:
  - text input
  - textarea
  - select/dropdown
  - Select2-like custom select
  - custom multi-select checklist
  - radio
  - checkbox
  - buttons and links
- Captures selector fallback candidates:
  - `data-testid`
  - `id`
  - role/text
  - CSS
  - XPath

### Replay And Validation

- Replay one step, one group, the full flow, or a composed suite.
- Scrolls to and highlights elements before replaying actions.
- Supports background suite execution so a multi-flow suite can continue outside the popup lifecycle.
- Produces structured pass/fail results.

### CSV Data Loop

- Imports CSV test data.
- Binds CSV columns to recorded input steps.
- Runs the same flow once per row.
- Stops early on row failure and records row-level results.

### Suite Builder

- Imports multiple action-log JSON files as reusable flows.
- Reorders flows with a visual suite builder.
- Runs flows in order through the background runner.
- Downloads a merged suite action log.

### Reports

- Exports JSON and HTML reports.
- Includes replay, CSV loop, and suite result data.
- Captures a visible-tab screenshot on failure when Chrome allows it.

### Playwright Generation Pipeline

Lane B consumes exported action logs and turns them into Playwright test assets:

- Validates and adapts the action-log contract.
- Generates JavaScript Playwright specs.
- Generates Page Object Model files.
- Uses `test.step(...)` blocks for readable execution output.
- Runs a reviewer loop before runtime execution.
- Runs generated tests through Playwright validation.
- Writes generation and runtime artifacts for traceability.

## Technical Highlights For Recruiters

- **End-to-end product thinking:** the project starts from a real manual QA workflow, not from a toy automation script.
- **Browser extension engineering:** Manifest V3 extension with popup UI, content scripts, shared engines, and background service worker orchestration.
- **Automation architecture:** clear separation between recording, normalization, replay, reporting, and Playwright generation.
- **Stable contract design:** exported action-log JSON is the boundary between manual QA tooling and generated automation.
- **Selector resilience foundation:** every action stores multiple selector candidates for future self-healing.
- **Data-driven testing:** CSV binding converts one recorded flow into many test executions.
- **Runtime feedback loop:** generated tests are reviewed, executed, classified, and logged.
- **Maintainable generated code:** Playwright output uses JavaScript, Page Object Model structure, and readable `test.step(...)` groups.

## Architecture

```text
Manual Tester
  -> Chrome Extension Recorder
  -> Readable Test Steps
  -> Replay Engine
  -> Action Log JSON
  -> Reports

Action Log JSON
  -> Contract Adapter
  -> Playwright Generator
  -> Reviewer
  -> Runtime Validation
  -> Generated Spec + POM
```

The most important design decision is the action log contract. Lane A does not expose temporary Chrome popup state to Lane B. Instead, Lane B consumes exported JSON artifacts that preserve tester intent, groups, selectors, control metadata, datasets, and run policy.

## Demo Application

The repository includes a safe local demo shop used for recording and replaying flows.

Main business flow:

1. Login.
2. Add product to cart.
3. Open cart.
4. Checkout.
5. Confirm order.

The checkout flow intentionally includes different control types so the recorder can demonstrate realistic form handling.

## Project Structure

```text
extension/      Chrome extension recorder, replay UI, suite UI
public/         Local demo shop frontend
src/app/        Express demo server
src/contract/   Action-log validation and adapter
src/generator/  Playwright spec and POM generation
src/runtime/    Runtime action-log runner and result classifier
src/agents/     Generator/reviewer orchestration
tests/          Unit, runtime, and generated Playwright tests
samples/        CSV test data
context/        Architecture and contract documentation
docs/           Verification checklist
artifacts/      Generation and Playwright result artifacts
logs/           Local action-log files for demo/development
```

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
5. Select the `extension/` folder.

Detailed extension usage is documented in [extension/README.md](extension/README.md).

## Demo Flow

1. Start the demo app with `npm start`.
2. Open `http://localhost:4173`.
3. Open the Factory Recorder extension popup.
4. Start recording.
5. Perform login, add-to-cart, checkout, and confirmation.
6. Stop recording and review the generated readable steps.
7. Replay a step, group, full flow, CSV loop, or suite.
8. Export the action log or report.
9. Use the exported action log as input for Playwright generation.

## Useful Commands

```powershell
npm start
npm run contract:validate
npm run test:contract
npm run test:runtime-classifier
npm run test:json -- logs/Manual-QC-Suite.json
npm run test:json:headed -- logs/Manual-QC-Suite.json
npm run generate:test
npm run test:e2e
npm run test:security
npm run test:security:headers
npm run test:security:response
npm run test:security:tampering
npm run test:security:object-access
npm run demo:security
npm run demo:security:tampering
npm run demo:security:object-access
```

`npm run test:json` runs an exported action log directly through the shared Playwright runtime runner.

`npm run generate:test` reads an action log, generates Playwright test files, runs review/runtime validation, and writes artifacts such as:

```text
tests/generated/<flow-name>.spec.js
tests/generated/pages/<flow-name>.page.js
artifacts/generation-log.json
artifacts/playwright-results.json
```

`npm run test:security` replays the selected action log through Playwright and runs safe XSS payload checks through the real UI inputs. `npm run test:security:headers` runs the security header audit. `npm run test:security:response` runs response-level rules for headers, cookies, and data exposure. `npm run test:security:tampering` replays the normal checkout flow, captures same-origin JSON API requests, selects safe order-like targets, clones them, changes server-side parameters, and expects the API to reject invalid values. `npm run test:security:object-access` creates an order as Alice, verifies Bob cannot read it, and verifies an anonymous request is rejected.

Use `npm run demo:security` to watch the browser run headed. The same runner also accepts environment flags:

```powershell
$env:HEADLESS='false'; npm run test:security
$env:SECURITY_ACTION_DELAY='1000'; npm run demo:security
$env:SECURITY_CHECKS='headers'; npm run test:security
$env:SECURITY_CHECKS='headers,cookies,data-exposure'; npm run test:security
$env:SECURITY_CHECKS='request-tampering'; npm run test:security
$env:SECURITY_CHECKS='object-access'; npm run test:security
```

Security runs write readable artifacts:

```text
artifacts/security-report.json
artifacts/security-report.html
```

Recruiter demo script:

1. Run `npm run demo:security`.
2. Point out that Playwright replays the recorded business flow.
3. Point out that the security runner injects safe XSS payload markers into real UI fields.
4. Open `artifacts/security-report.html` to show the pass/fail summary and payload evidence.

Server-side tampering demo script:

1. Run `npm run demo:security:tampering`.
2. Watch Playwright submit the checkout form normally.
3. Explain that the runner then reuses a captured same-origin API request and sends modified values directly to the server.
4. Open `artifacts/security-report.html` and show that invalid select/radio/checkbox/text parameters were rejected by server-side validation.

Object-access demo script:

1. Run `npm run demo:security:object-access`.
2. Watch Playwright create an order through the normal checkout flow.
3. Explain that the runner opens a separate Bob session and an anonymous session, then tries to read Alice's order.
4. Open `artifacts/security-report.json` to show Bob gets `403` and anonymous gets `401`.

## Action Log Contract

The exported action log is the central artifact of this project.

It stores:

- metadata and schema version
- session and test case information
- readable groups/screens
- normalized actions
- selector fallback candidates
- dataset bindings
- run policy

See [context/action-log-schema.md](context/action-log-schema.md) for contract details.

## Testing And Quality

The repository includes checks for the critical contract and runtime pieces:

- contract adapter unit test
- runtime result classifier unit test
- generated Playwright data test
- action-log runtime Playwright test
- generated spec/POM examples

This keeps the project focused on the risky boundaries: data contract compatibility, replay behavior, and generated automation validity.

## What I Would Improve Next

- Add a side panel UI for a more production-like Chrome extension experience.
- Expand contract validation with stricter schema coverage.
- Implement selector self-healing using captured fallback selectors and runtime failure classification.
- Add richer report history and comparison across runs.
- Package the demo for easier evaluator setup.

## Safety Note

This project is intended for the included local demo application and authorized test environments only. It should not be used to record or automate unauthorized third-party websites.
