# Phase Roadmap

## Phase 0: Foundation

Status: Done

Purpose:

- Define project rules, context, skills, agents, and planning.

## Lane A: Manual QC Assistant

Lane A MVP is complete and remains the stable foundation for later lanes.

### Phase A1: Recorder + Replay MVP

Status: Done for MVP

Goal:

- Build a Chrome extension that records manual QC actions and replays them.

Deliverables:

- Chrome extension manifest.
- Recorder content script.
- Selector extraction.
- Action normalization.
- Readable testcase-style steps.
- Popup step list.
- Test case name.
- Group/screen context.
- Fixed repeat count per group.
- Replay step.
- Replay group.
- Replay all.
- Replay narration overlay.
- Save/download action log.
- Record and replay text, textarea, select, radio, and checkbox controls.
- Local save/load through the demo server.

Acceptance checks:

- Tester can record a real browser flow.
- Tester can review readable steps.
- Tester can replay step/group/all.
- Tester can set fixed repeat count for a group.
- Tester can save/export action log.

Remaining future polish:

- Browser Back/Forward/Reload recording.
- Manual selector editor.

### Phase A2: CSV/Data Loop

Status: Done for MVP

Goal:

- Let QC manual testers repeat recorded flows with CSV data.

Deliverables:

- CSV import.
- Dataset preview.
- Binding CSV columns to input steps.
- Variable values in step descriptions, for example `${name}`.
- Run flow once per CSV row.
- Row-level pass/fail result.
- Demo safety loop limit.
- Stop on first failed row.
- UTF-8 and Shift-JIS CSV reading for Japanese CSV files.

Acceptance checks:

- Tester imports CSV.
- Tester maps CSV columns to input steps.
- Tester runs flow for multiple rows.
- Tester sees pass/fail per row.
- Exported action log includes dataset binding metadata.
- Loop stops on first failed row.

### Phase A3: Recorder UX Polish

Status: Done for MVP

Goal:

- Improve recorder usability after A1/A2 are stable.

Delivered:

- Edit step description.
- Edit group/screen name.
- Import saved action log.
- Wrong-screen warning.
- Step status list.
- Visual Suite Builder with drag/drop flow order.
- Suite run through background service worker.
- Auto open/focus local demo tab for runner commands.

Future polish:

- Replay selected range.
- Side panel if popup becomes too limited.
- Multi-testcase library.

### Phase A4: Manual QC Reports

Status: Done for MVP

Goal:

- Provide useful reports for replay and CSV loops.

Deliverables:

- Replay run history.
- CSV row result summary.
- Failed step details.
- Export run result JSON or HTML.
- Suite run result summary.
- Failure screenshot in HTML report when available.

## Lane B: AI Automation Factory

Lane B is future scope after Lane A has a stable foundation.

### Phase B1: Testcase Input Mode

Goal:

- User provides testcase text; system converts it into structured steps.

### Phase B2: UI Exploration And Element Mapping

Goal:

- Map testcase steps to UI elements using selector cache and filtered DOM.

### Phase B3: Playwright Code Generation

Goal:

- Generate readable Playwright tests from structured flows/action logs.

### Phase B4: Runtime Validation

Goal:

- Run generated Playwright tests and classify failures.

### Phase B5: Self-Healing

Goal:

- Heal selector failures only.

## Final Phases

### Phase F1: Dashboard

Goal:

- Show recorded flows, replay results, CSV loop results, generated automation, and healing events.

### Phase F2: Customer Demo Package

Goal:

- README in Vietnamese/English plus short Japanese summary, Mermaid diagrams, and demo script.
