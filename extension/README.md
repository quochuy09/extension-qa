# Factory Recorder Chrome Extension

## Purpose

This is the primary recorder for the demo.

It records manual QA actions from the local demo shop, replays them, runs CSV data loops, builds simple suites, and exports action/report JSON or HTML.

## Load Extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the `extension` folder in this repository.

## Demo Flow

1. Run the demo app:

```powershell
npm start
```

2. Open:

```text
http://localhost:4173
```

3. Open the Factory Recorder extension popup.
4. Use the Record tab and click Start.
5. Perform login, add to cart, cart, checkout, including dropdown/radio/checkbox/textarea controls.
6. Click Stop.
7. Review the recorded steps in the Record tab. Steps are shown as readable manual test instructions.
8. Use the Replay tab to mark groups repeatable, choose replay speed, and run actions.
9. Click Download to create a portable action-log JSON file.
10. Use Save Local / Load Local only for the current project folder under `logs/`.

## Menus

- Record: record/edit the current testcase.
- Replay: load an action log and run current steps or groups.
- Data: load an action log, import CSV, and run data loops.
- Suite: import multiple flows, reorder them, download a merged flow, and run them in order.
- Report: inspect and export the latest run result as JSON or HTML.

## Supported Recorded Controls

The recorder/replay MVP supports:

- Clicks on buttons/links.
- Text input.
- Textarea.
- Dropdown/select.
- Radio buttons.
- Checkboxes.

The demo checkout page intentionally includes these control types.

## CSV Data Loop

Phase A2 supports a simple CSV loop for manual QC data creation.

1. Record a flow with input steps.
2. Load a CSV file from the CSV Data Loop section.
3. Bind each input step to a CSV column using the dropdown.
4. Click Start in the Data tab.

Rules:

- The extension runs all recorded steps once per CSV row.
- Maximum rows for the demo is 100.
- If a row fails, the loop stops immediately.
- Unbound input steps keep their recorded values.
- Bound input steps use the current CSV row value.

Sample CSV:

```text
samples/checkout-users.csv
```

## Reports

The popup shows the latest replay, CSV loop, or suite result in the Report tab.

You can export the report as:

```text
manual-qc-run-report.json
manual-qc-run-report.html
```

Failure reports include fallback error text. HTML reports include a visible-tab screenshot when Chrome allows capture.

## Import Existing Recording

Use the Import action log field to load a previously exported `action-log.json` back into the extension.

## Local Save vs Download

- Download creates a portable JSON file. Use this when moving flows to another machine.
- Save Local writes to the current repository folder:
  - `logs/action-log.json`
  - `logs/<test-case-name>.json`
- Load Local loads the latest `logs/action-log.json`.
- Save Local does not overwrite a JSON file previously selected through the browser file picker.

## Visual Suite Builder

Use Suite Builder to combine reusable flows, such as Login followed by Checkout.

Supported in the MVP:

- Import one or more action-log JSON files as flows.
- Drag flows up/down to change run order.
- Run Suite.
- Download the suite as one merged flow JSON.
- Run Suite from a background service worker so multi-flow runs continue even if the popup closes.

Typical reusable setup:

```text
Login flow -> Checkout flow
```

Suite CSV is intentionally hidden in the MVP. It needs a clearer design for whether CSV data is global to the suite or owned by each flow.

## Notes

The previous Playwright recorder remains useful as a repeatable fixture generator, but customer demos should present this extension as the main recorder.

Chrome popup windows close when focus returns to the page. The content script therefore shows a small in-page recording overlay with the live step count while the tester is interacting with the demo shop. The popup remains the management UI for reviewing, deleting, repeat settings, and exporting.

Replay highlights and scrolls to each element before acting, and shows a replay narration overlay such as `Running Step 3/9: Click Login button`. It is a quick selector/action validation tool, not a replacement for Playwright runtime validation.

For Suite runs, the extension uses a background runner. It opens or focuses the local demo tab, navigates to each flow start URL, and stores the result in `chrome.storage.local`.
