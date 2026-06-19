# Lane A Verification Checklist

## Setup

1. Run the demo server:

```powershell
npm start
```

2. Open Chrome:

```text
chrome://extensions
```

3. Load or reload the unpacked extension from:

```text
d:\github_demo\extension
```

4. Open:

```text
http://localhost:4173
```

## A1 Recorder + Replay

- Start recording.
- Complete login, add to cart, cart, checkout, confirmation.
- Include checkout controls: dropdown, radio, checkbox, textarea.
- Stop recording.
- Confirm readable steps are shown in the Record tab.
- Edit one step description.
- Open the Replay tab.
- Edit one group name or screen name.
- Run one step from the correct screen.
- Run one group from the correct screen.
- Navigate back to `http://localhost:4173`, then Run All.
- Confirm replay narration appears on the page.
- Save action log.
- Download action log.
- Import the downloaded action log.

Expected:

- Steps remain readable.
- Selectors are visible in each expanded step.
- Replay highlights elements and restores text, textarea, dropdown, radio, and checkbox values.
- Wrong-screen warning appears when replay starts from a different route.

## A2 CSV/Data Loop

Use:

```text
samples/checkout-users.csv
```

- Load CSV in the CSV Data Loop section.
- Bind Full name input to `full_name`.
- Bind Postal code input to `postal_code`.
- Navigate to `http://localhost:4173`.
- Click Start in the Data tab.

Expected:

- The flow runs once per CSV row.
- Each row starts from the first recorded URL.
- The run stops on first failure.
- Run Report shows row-level pass/fail.
- Export Report downloads `manual-qc-run-report.json`.

## A3 Visual Suite Builder

- Record or import a Login flow.
- Download the Login action log.
- Record or import a Checkout flow.
- Download the Checkout action log.
- Open Suite tab and Import Flow for both action-log files.
- Confirm both flows appear as visual nodes.
- Drag flow nodes to change order.
- Click Run Suite.

Expected:

- Flows run in visual order.
- Each flow starts from its saved recording URL.
- Suite continues even if the popup closes because the background runner owns the orchestration.
- Suite stops on the first failed flow or step.
- Run Report shows flow-level pass/fail.
- HTML report includes failure screenshot when capture is available.

## A3 Hidden/Future Scope

- Suite CSV is intentionally hidden in the MVP.
- Browser Back/Forward/Reload recording is future scope.
- Multi-testcase library is future scope.

## Known Lane A Limits

- CSV loop supports CSV only, not Excel.
- CSV loop max row count is 100.
- Suite replay uses a background runner tab.
- Record/Replay/Data popup actions still use extension popup orchestration.
- Replay is not Playwright validation.
- Multi-testcase library is future scope.
