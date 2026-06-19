# Project Context

## Business Context

This repository is a portfolio-quality demo for Japanese customers.

The current implemented product lane is a **Manual QC Assistant**: a Chrome extension that helps manual testers record browser steps, replay them, repeat them with CSV data, combine flows into suites, and export reports.

The AI Automation Factory is still part of the long-term vision, but it is not the first implementation priority.

## Product Lanes

### Lane A: Manual QC Assistant

MVP complete.

Purpose:

- Support existing manual QC work.
- Record real tester actions.
- Convert browser actions into readable testcase steps.
- Replay step, group, or full flow.
- Repeat flows with CSV data.
- Combine reusable flows with Suite Builder.
- Produce useful execution logs for manual testers.

Example:

```text
Step 1: Open URL /customers
Step 2: Click Create button
Step 3: Input ${name} into Name field
Step 4: Input ${email} into Email field
Step 5: Click Save button

Dataset: customers.csv
Loop: 100 rows
```

### Lane B: AI Automation Factory

Future lane.

Purpose:

- Accept a testcase or action log.
- Analyze user intent.
- Explore/map UI elements.
- Generate Playwright automation.
- Validate generated tests.
- Self-heal selector failures.

Lane B should reuse Lane A assets:

- action log schema
- selector fallback data
- replay validation logic
- dataset bindings
- execution reports

The exported action log JSON is the official boundary between Lane A and Lane B. Lane B should not depend on Chrome popup state or transient extension storage.

## Current Core Story

Lane A completed MVP story:

1. QC manual opens the local demo app.
2. QC manual starts the Chrome extension recorder.
3. QC manual performs a business flow.
4. The extension records actions as readable testcase steps.
5. QC manual reviews steps in the popup.
6. QC manual replays a step, group, full flow, CSV loop, or suite.
7. QC manual exports or saves an action log.
8. QC manual exports a JSON/HTML report.

## Target Demo App

The demo focuses on a safe local application: a small demo shop.

We do not test unauthorized third-party websites.

## Current Target Flow

Business flow:

1. Login.
2. Add product to cart.
3. Open cart.
4. Checkout.
5. Confirm order.

Expected groups:

- Login
- Product Selection
- Cart
- Checkout
- Confirmation

## Important Direction

- Chrome extension recorder is the primary recorder.
- Playwright scripted recorder is only a fixture/helper.
- Extension replay is quick validation for QC manual, not Playwright runtime validation.
- Lane A MVP is complete; future work should focus on stabilization, Side Panel/production UX, or Lane B.
- Exported action logs are the source contract for Playwright generation and self-healing.
- AI/Codex usage should be minimized and moved to Lane B.

## Demo Audience Expectations

Japanese customer-facing demo requirements:

- Clean code.
- Clear logs.
- Stable local demo.
- Readable testcase steps.
- Practical manual QC value before AI features.
- Clear separation between portable downloaded action logs and local project saves.
- Documentation that clearly separates implemented features from future AI scope.

## Non-Goals For Lane A

- Building a production SaaS.
- Testing unauthorized external websites.
- AI-based testcase generation.
- Playwright code generation.
- Self-healing automation.

These are either out of scope or belong to Lane B.
