# Action Log Schema Context

## Purpose

The action log is the contract between the Chrome extension and later pipeline features.

For Lane A, it supports:

- readable manual QC steps
- replay
- group repeat
- CSV/data loop
- manual QC reports

For Lane B, it will later support:

- testcase analysis
- UI mapping
- Playwright generation
- Playwright runtime validation
- self-healing context

## Action Log Contract For Lane B

The action log JSON is the primary portable contract between Lane A and Lane B.

Lane B must treat an exported action log as:

- the source of user intent
- the source of readable test steps
- the selector candidate cache
- the grouping structure for Playwright `test.step(...)`
- the data-binding source for data-driven tests

Lane B must not depend on:

- Chrome popup state
- `chrome.storage.local`
- local `logs/action-log.json`
- transient Suite Builder UI state

Rules:

- Do not introduce breaking schema changes without increasing `metadata.schemaVersion`.
- Keep action logs portable across machines.
- Keep user intent immutable where possible; selector healing should patch generated code or a selector cache, not silently rewrite the original business intent.
- Preserve all selector candidates even when one selector is selected as primary.
- Playwright generation should prefer deterministic mapping before using AI.
- Self-healing should use action log selectors and action context as evidence, not as the only source of truth.

Recommended selector priority for Playwright generation:

1. `selectors.testId`
2. `selectors.roleText`
3. `selectors.id`
4. `selectors.css`
5. `selectors.xpath`

Recommended Playwright mapping:

| Action log field | Playwright usage |
| --- | --- |
| `testCase.name` | `test(...)` title |
| `session.startUrl` | initial `page.goto(...)` |
| `groups[]` | `test.step(...)` blocks |
| `actions[].description` | step/comment/report text |
| `actions[].type` | action dispatch |
| `actions[].controlType` | API selection, such as `fill`, `selectOption`, `check` |
| `actions[].selectors` | locator generation and fallback cache |
| `datasets` / `bindings` | data-driven test loop |
| `runPolicy` | generated test execution policy |

Generation requirements:

- Output language: JavaScript.
- Required pattern: POM - Page Object Model.
- Specs must use `test.step(...)` for meaningful groups/action sequences.
- Locator logic should live in page object classes/modules where practical.
- Specs should call page object methods so the generated test remains readable.

## Current Schema

```json
{
  "metadata": {
    "schemaVersion": 1,
    "generatedAt": "2026-06-18T00:00:00.000Z",
    "source": "chrome-extension-recorder",
    "targetApp": "factory-demo-shop",
    "actionCount": 1
  },
  "session": {
    "startUrl": "http://localhost:4173",
    "browser": "chrome",
    "recordedBy": "manual-qa"
  },
  "testCase": {
    "name": "Checkout flow",
    "description": "Manual QC recorded checkout flow"
  },
  "groups": [
    {
      "name": "Login",
      "screenName": "Login Page",
      "repeat": {
        "enabled": false,
        "count": 1,
        "mode": "fixed-count",
        "dataset": null
      },
      "startedAtActionId": "act-001",
      "actionIds": ["act-001"]
    }
  ],
  "actions": [
    {
      "id": "act-001",
      "description": "Click Login button",
      "timestamp": "2026-06-18T00:00:00.000Z",
      "type": "click",
      "value": null,
      "url": "http://localhost:4173/#/login",
      "title": "Factory Demo Shop",
      "groupName": "Login",
      "screenName": "Login Page",
      "targetTag": "button",
      "targetText": "Login",
      "controlType": "button",
      "primarySelector": "[data-testid=\"login-button\"]",
      "selectors": {
        "testId": "[data-testid=\"login-button\"]",
        "id": "#login-button",
        "roleText": "getByRole('button', { name: 'Login' })",
        "css": "#login-button",
        "xpath": "//*[@data-testid=\"login-button\"]"
      },
      "elementSignature": "[data-testid=\"login-button\"]"
    }
  ]
}
```

## Dataset Extension

CSV/data loop extends the schema without breaking normal replay.

Current shape:

```json
{
  "datasets": [
    {
      "id": "customers",
      "name": "customers.csv",
      "columns": ["name", "email"],
      "rowsPreview": [
        {
          "name": "Taro Yamada",
          "email": "taro@example.com"
        }
      ]
    }
  ],
  "bindings": [
    {
      "actionId": "act-003",
      "datasetId": "customers",
      "column": "name"
    }
  ],
  "runPolicy": {
    "maxRows": 100,
    "stopOnFirstFailure": true
  }
}
```

During replay:

- unbound input steps use recorded `value`
- bound input steps use the CSV row value
- click steps are unchanged

## Control Metadata

Input-like actions may include control metadata:

```json
{
  "type": "input",
  "controlType": "select",
  "value": "express",
  "selectedText": "Express delivery"
}
```

Supported `controlType` values in Lane A MVP:

- text/password-like input
- textarea
- select
- radio
- checkbox

Radio and checkbox actions include:

```json
{
  "checked": true
}
```

CSV binding currently applies to text-like, textarea, and select actions. Radio and checkbox bindings are intentionally excluded from the MVP.

## Suite And Reports

Suites are stored in extension state rather than inside a single action log. A suite references multiple imported action logs and can download a merged action log for portability.

For Lane B:

- Playwright generator should consume exported action logs or merged suite action logs.
- It should not read Suite Builder state directly.
- If suite-level generation is needed, first export/download a merged flow or define a separate suite contract later.

Reports are exported separately as:

- `manual-qc-run-report.json`
- `manual-qc-run-report.html`

Failure report entries may include a screenshot data URL when Chrome capture is available.

## Rules

- Store multiple selector candidates.
- Keep `description` readable for manual QC.
- Keep `type`, `value`, and `selectors` machine-readable.
- Preserve group and screen context.
- Do not require AI to replay Lane A flows.
- Dataset import and binding are implemented in Lane A MVP.
- Playwright generation and self-healing must consume this schema through a stable adapter layer.
