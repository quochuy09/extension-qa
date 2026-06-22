# Project Planning

## Product Vision

Build a demo tool for Japanese customers that starts from a practical QC manual assistant and can later grow into an AI automation factory.

The project has two product lanes:

```text
Lane A - Manual QC Assistant
Lane B - AI Automation Factory
Lane C - Flow-Based Security Automation
```

Current priority: **Lane B planning after Lane A MVP completion**.

Reason:

- It solves a clear QC manual pain point.
- It gives testers immediate value: record, replay, repeat with data.
- It creates stable action logs, selector cache, and replay logic that Lane B can reuse later.
- It reduces risk before adding AI-heavy features.

## Lane A: Manual QC Assistant

Goal:

- Help QC manual testers record browser steps, replay them, and repeat them with test data.

Core user story:

```text
As a QC manual tester,
I want to record my browser actions as readable test steps,
then replay them or repeat them with CSV data,
so that I can create test data and validate flows faster.
```

Example:

```text
Test case: Create customers

Step 1: Open URL /customers
Step 2: Click Create button
Step 3: Input ${name} into Name field
Step 4: Input ${email} into Email field
Step 5: Click Save button

Dataset: customers.csv
Loop: 100 rows
```

Lane A does not require AI for the core value.

## Lane B: AI Automation Factory

Goal:

- Let a user provide a testcase, then the system analyzes it, explores/maps UI, generates Playwright automation, validates runtime, and self-heals selector failures.

Core user story:

```text
As an automation engineer,
I want to provide a testcase or action log,
then have agents generate and maintain Playwright tests,
so that automation creation and maintenance are faster.
```

Important note:

- Lane B may use AI/Codex.
- It cannot be guaranteed to be token-free.
- Token usage should be reduced by deterministic parsing, selector cache, DOM filtering, templates, and only calling AI when needed.

## Lane C: Flow-Based Security Automation

Goal:

- Reuse recorded business flows to run readable security checks without depending on OWASP ZAP logs.

Core user story:

```text
As an SDET,
I want to record a normal user flow once,
then replay it with Playwright security checks,
so that Dev can see which step/request caused a security finding.
```

Current direction:

- Extension captures optional network evidence for requests caused by recorded actions.
- Playwright security runner replays the UI flow first.
- XSS payloads are injected into real UI input fields by default.
- Request tampering uses Playwright runtime request capture as the primary source, then clones safe same-origin order-like JSON API requests with modified parameters.
- Request tampering records targets, attempts, skipped request reasons, mutation category, and action-field mapping confidence.
- Object-access proof uses local demo identities: Alice creates an order, Bob is rejected with `403`, and anonymous access is rejected with `401`.
- Security HTML report shows tampering targets, attempts, skipped requests, findings, and object-access proof details.
- Rules are OWASP-aligned, not ZAP-dependent.

## Agent Workflow

All future implementation phases should follow:

```text
Implementation Planner
-> Plan Reviewer
-> Domain Engineer
-> Domain Reviewer
-> Runtime Validator
```

Lane C security work uses the specialized chain:

```text
Security Planner
-> Security Plan Reviewer
-> Security Implementation Engineer
-> Security Reviewer
-> Runtime Validator
```

See:

- `agents/workflow-plan-review-implement-test.md`
- `agents/agent-registry.md`
- `agents/interaction-contract.md`

## Current Working Lane

Current lane:

- Lane A: Manual QC Assistant is MVP complete.
- Lane B: AI Automation Factory is the next major lane.

Current phase:

- Lane A stabilization and documentation pass

Current status:

- Phase A1 complete for MVP.
- Phase A2 complete for MVP.
- Phase A3 complete for MVP.
- Phase A4 complete for MVP.

Current task:

- Lock the action log JSON as the Lane B contract after Lane A MVP confirmation.

Phase A2 decisions:

- Run scope: Run All once per CSV row.
- Binding UI: dropdown per input step.
- Storage: `chrome.storage.local`.
- Max rows: 100.
- Failure policy: stop on first failed row.

Suite Builder decisions:

- Visual builder uses HTML/CSS drag-drop flow nodes.
- No canvas library in MVP.
- Each flow is imported from its own action-log JSON.
- Suite can download imported flows as one merged action-log JSON.
- Each flow keeps its recorded URL inside its action log.
- Suite CSV is hidden from MVP because it needs a clearer design for per-flow CSV ownership and binding.
- No branching/if-else in MVP.

Action Log Contract decisions:

- Exported action log JSON is the primary portable contract from Lane A to Lane B.
- Playwright generator must read action logs through a stable adapter layer.
- Playwright generator must not read Chrome popup state or `chrome.storage.local` directly.
- Suite Builder state is UI state; Lane B should use exported action logs or merged suite action logs.
- Selector healing should patch generated Playwright code or selector cache, not silently rewrite original user intent in the source action log.
- Breaking schema changes require `metadata.schemaVersion` increment.

## Phase Overview

```text
Phase 0  - Foundation and project rules

Lane A - Manual QC Assistant
  Phase A1 - Recorder + Replay MVP
  Phase A2 - CSV/Data Loop
  Phase A3 - Recorder UX Polish
  Phase A4 - Manual QC Reports

Lane B - AI Automation Factory
  Phase B1 - Testcase Input Mode
  Phase B2 - UI Exploration and Element Mapping
  Phase B3 - Playwright Code Generation
  Phase B4 - Runtime Validation
  Phase B5 - Self-Healing

Final
  Phase F1 - Dashboard
  Phase F2 - README and customer demo package
  Phase F3 - Portable demo package
```

## Phase 0: Foundation

Status: Done

Completed:

- Project rules.
- Project context.
- Architecture context.
- Agent definitions.
- Skill definitions.
- Initial planning.

Key files:

- `RULE.md`
- `context/project-context.md`
- `context/architecture.md`
- `context/action-log-schema.md`
- `context/phase-roadmap.md`
- `agents/agent-registry.md`
- `agents/interaction-contract.md`
- `skills/*.md`

Future maintenance:

- Keep context files synchronized when Lane B planning starts.
- Keep AI-heavy items in Lane B/future scope.

## Phase A1: Recorder + Replay MVP

Status: Done for Lane A MVP

Goal:

- Build a Chrome extension that supports QC manual recording and replay.

Completed:

- Chrome Manifest V3 extension.
- Record click/input/change actions.
- Selector fallback extraction:
  - `data-testid`
  - `id`
  - role/text
  - css
  - xpath
- Action normalization.
- Human-readable step descriptions.
- Test case name.
- Step list in popup.
- Group/screen context.
- Repeatable group toggle.
- Fixed loop count per group.
- Delete step.
- Download action log JSON.
- Save action log to `logs/action-log.json` through local server.
- Save action log to `logs/<test-case>.json` through local server.
- Load latest local action log from `logs/action-log.json`.
- Replay single step.
- Replay group.
- Replay all.
- Replay respects group repeat count.
- Replay input overwrites existing value.
- Recorder captures text input, textarea, select/dropdown, radio, and checkbox controls.
- Replay supports text input, textarea, select/dropdown, radio, and checkbox controls.
- Recorder and replay support Select2-like custom single select controls. Implemented.
- Recorder and replay support custom multi-select checklist controls. Implemented.
- Demo routes reset form controls to their default values when opened again.
- Replay scrolls to element.
- Replay highlights element.
- Replay types input values character by character.
- Replay speed selector:
  - Slow
  - Demo
  - Normal
- Replay narration overlay:
  - `Running Step X/Y: ...`

Key files:

- `extension/manifest.json`
- `extension/shared/selector-engine.js`
- `extension/shared/action-normalizer.js`
- `extension/content/recorder.js`
- `extension/content/replay-engine.js`
- `extension/popup/popup.html`
- `extension/popup/popup.css`
- `extension/popup/popup.js`
- `extension/README.md`
- `src/app/server.js`

Remaining after MVP:

- Keep manual verification checklist updated as features change.
- Keep docs clear that Playwright scripted recorder is only a fixture/helper.

Acceptance criteria:

- Tester can load the extension.
- Tester can record a real flow.
- Tester can review readable steps.
- Tester can replay one step.
- Tester can replay one group.
- Tester can replay all steps.
- Tester can set fixed repeat count for a group.
- Tester can save/export action log.
- Tester can load the latest locally saved action log without selecting an old downloaded file.
- Tester can record and replay common form controls: text, textarea, dropdown, radio, checkbox.
- Tester can record and replay custom controls: Select2-like single select and multi-select checklist.
- Action log is readable and stable.

## Phase A2: CSV/Data Loop

Status: Done for Lane A MVP

Goal:

- Let QC manual testers repeat recorded steps with CSV data.

Core feature:

```text
Import CSV
Map CSV columns to recorded input steps
Run flow once per CSV row
Show row-level pass/fail result
```

Example:

```csv
name,email,postal_code
Taro Yamada,taro@example.com,100-0001
Hanako Sato,hanako@example.com,150-0001
```

Mapped steps:

```text
Input ${name} into Full name field
Input ${postal_code} into Postal code field
```

Planned scope:

- CSV import in extension.
- Dataset preview.
- Variable binding UI for input steps.
- Replace recorded values with `${column}` variables.
- Run All with dataset rows.
- Row-level replay result:
  - row number
  - status
  - failed step
  - error reason
- Limit loop count for demo safety.
- Stop on first failed row.

Important behavior:

- If no dataset is attached, replay uses recorded values.
- If dataset is attached, input steps with bindings use CSV row values.
- Click steps remain unchanged.

Acceptance criteria:

- Tester imports CSV.
- Tester maps columns to input steps.
- Tester runs flow for multiple rows.
- Extension shows pass/fail per row.
- Exported action log includes dataset binding metadata.
- Execution stops on the first failed row.

Out of scope for Phase A2:

- Excel import.
- Complex data generation.
- Conditional branching.
- AI-based data creation.

## Phase A3: Recorder UX Polish

Status: Done for Lane A MVP

Goal:

- Make the recorder closer to a production QC tool.

Candidate features:

- Edit step description. Implemented.
- Edit group name. Implemented.
- Edit screen name. Implemented.
- Edit test case description.
- Step status:
  - pending
  - running
  - passed
  - failed
- Import saved action log back into extension. Implemented.
- Replay selected range.
- Wrong-screen warning before replay. Implemented.
- Better error display. Basic implementation.
- Side panel instead of popup if popup becomes too small.
- Visual Suite Builder. Implemented.
- Drag/drop flow order. Implemented.
- Run Suite. Implemented.
- Run Suite with CSV. Hidden from MVP, future scope.
- Per-tab status dots for Record, Replay, Data, and Suite. Implemented.
- Button click highlight. Implemented.
- Replay/Data action-log file name display. Implemented.
- Suite merged-flow download. Implemented.
- Japanese CSV reading support for UTF-8 and Shift-JIS. Implemented.
- Auto open/focus local demo tab before Record/Replay/Data/Suite commands, with tab-load wait/retry. Implemented.
- Demo tab is opened in the background first so the popup orchestration is not interrupted by Chrome closing the popup on tab focus. Implemented.
- Suite runner always navigates to each flow start URL before executing that flow. Implemented.
- Suite runner keeps one fixed demo tab for the whole run to avoid sending later flows to a different localhost tab. Implemented.
- Run Suite orchestration moved to a background service worker so multi-flow runs continue even if the popup closes. Implemented.

Not approved yet:

- Drag/drop reorder.
- Multi-testcase library.
- Manual selector editor.
- Assertion authoring UI.
- Browser navigation recording:
  - Back
  - Forward
  - Reload
  - Direct URL changes
  - SPA route changes not caused by recorded clicks
- Suite CSV design:
  - Decide whether CSV is global for the whole suite or attached to each flow.
  - Decide how testers map columns when multiple flows have input steps.
  - Decide whether each flow can use a different CSV file.

## Phase A4: Manual QC Reports

Status: Done for Lane A MVP

Goal:

- Produce useful reports for manual replay and CSV loop runs.

Planned:

- Replay run history. Latest run only.
- CSV row execution summary. Implemented.
- Failed row details. Implemented.
- Failed step details. Implemented.
- Suite report no longer overwrites Replay with the last flow execution.
- Failed step is shown only for failed flows/rows; passed flows show completion status.
- Failure report includes a visible-tab screenshot when capture is available.
- Failure report uses fallback error text when no step-level result is returned.
- Export run result JSON. Implemented.
- Optional simple HTML report.

Acceptance criteria:

- Tester can see what ran, what passed, and what failed.
- Failed row/step is easy to identify.

## Lane B - Viec Con Lai

Muc tieu Lane B:

- Bien action log JSON tu Lane A thanh Playwright automation co the chay that, validate runtime, va self-heal khi selector bi doi.
- Uu tien duong di tu action log da export truoc. Khong phu thuoc popup state hay `chrome.storage.local`.

### Tong quan theo phase

#### B0 - Action Log Contract Adapter

- Muc tieu: doc action log JSON cua Lane A theo mot contract on dinh.
- Input: exported action-log JSON, merged suite JSON.
- Output: normalized automation contract object.
- Trang thai: implemented MVP.
- Can lam:
  - schema validation. Done.
  - adapter doc action log. Done.
  - selector priority resolver. Done.
  - control-type mapper. Done.
  - error message ro rang khi JSON sai format. Done.
  - future: validate merged suite JSON with more real samples.
  - future: add stricter dataset/binding validation.

#### B1 - Testcase Input Mode

- Muc tieu: user co the dua testcase text thay vi record bang extension.
- Input: testcase text paste/upload, optional action log tham chieu.
- Output: structured testcase/flow JSON.
- Trang thai: future.
- Can lam:
  - deterministic parser
  - detect cau mo ho
  - optional AI fallback
  - format intent trung gian de map sang UI/action

#### B2 - UI Exploration And Mapping

- Muc tieu: map structured intent vao element that tren UI.
- Input: structured testcase, selector cache tu action log, DOM hien tai.
- Output: validated element mapping.
- Trang thai: future.
- Can lam:
  - DOM snapshot filter
  - accessibility snapshot
  - selector validation
  - mapping cache
  - report cac step khong map duoc

#### B3 - Playwright Code Generation

- Muc tieu: sinh Playwright JavaScript spec + Page Object Model doc duoc va maintain duoc.
- Input: automation contract + element mappings.
- Output: Playwright JavaScript spec file + POM files.
- Trang thai: MVP done cho exported action log.
- Da lam:
  - dung Lane A action log schema thong qua contract adapter
  - output ngon ngu: JavaScript
  - model bat buoc: POM - Page Object Model
  - support control types: text, textarea, select, radio, checkbox
  - support custom controls: Select2-like single select, multi-select checklist
  - bat buoc dung `test.step(...)`
  - selector priority: testId -> roleText -> id -> css -> xpath
  - runtime runner dung chung co the chay truc tiep tu action log JSON
  - generator ghi ra ca spec va page object
  - reviewer check POM + `test.step`
  - Playwright runtime validation da chay pass
- Can lam sau:
  - CSV/data-driven loop trong generated Playwright
  - suite/merged flow generation
  - agent interaction log chi tiet hon

#### B4 - Runtime Validation

- Muc tieu: chay Playwright test that va lay ket qua runtime.
- Input: generated Playwright spec.
- Output: pass/fail result + artifacts.
- Trang thai: da co MVP runtime validation va failure classification co ban.
- Can lam:
  - classify failure. Basic implementation done.
  - attach trace/screenshot/report. Basic artifact pointers done.
  - dua runtime error quay lai generator/reviewer
  - luu validation history

#### B5 - Self-Healing

- Muc tieu: tu sua selector fail mot cach an toan.
- Input: failed Playwright run, selector cu, DOM/accessibility snapshot.
- Output: patched locator hoac selector cache + healing log.
- Trang thai: future.
- Can lam:
  - chi detect selector-not-found/timeout
  - khong heal assertion/business failure
  - propose selector moi
  - validate selector moi dung 1 element, visible, enabled
  - patch locator only
  - rerun test
  - log diff selector cu -> moi

#### F1 - Dashboard Integration

- Muc tieu: show full demo story ro rang cho khach hang.
- Input: recordings, generated tests, runtime results, healing events.
- Output: dashboard demo.
- Trang thai: future.
- Can lam:
  - test history
  - generation history
  - self-healing event table
  - selector diff
  - link toi artifacts

### Thu tu nen lam

1. B0 - Action Log Contract Adapter. MVP done.
2. B3 - Playwright generation tu exported action logs. MVP done.
3. B4 - Runtime validation loop. Next.
4. B5 - Self-healing cho selector failure.
5. B1/B2 - Testcase text va UI exploration sau khi action-log path da on dinh.

Nguyen tac chinh:

- Bat dau tu exported action logs.
- Khong de Lane B doc truc tiep popup state hay extension storage.
- Neu doi schema breaking thi phai tang `metadata.schemaVersion`.

## Phase B1: Testcase Input Mode

Status: Future

Goal:

- User provides a manual testcase and the system converts it into structured steps.

Input examples:

- Paste testcase text.
- Upload markdown/text testcase.
- Use existing recorded steps as reference.

Planned:

- Testcase parser.
- Structured flow JSON.
- Deterministic parser first.
- AI only when deterministic parser cannot handle ambiguity.

Acceptance criteria:

- Plain testcase text becomes structured steps.
- Ambiguous steps are flagged instead of silently guessed.

## Phase B2: UI Exploration and Element Mapping

Status: Future

Goal:

- Map structured testcase steps to UI elements.

Planned:

- Inspect current page DOM.
- Use selector cache from Lane A recordings.
- Map actions to elements.
- Validate selectors in browser.
- Store mapping cache.

Token-saving strategy:

- Use recorded selector cache first.
- Use filtered DOM, not full DOM.
- Use templates before AI.
- Call AI only for unresolved mappings.

## Phase B3: Playwright Code Generation

Status: MVP implemented for exported action logs

Goal:

- Generate readable Playwright JavaScript tests from structured flows/action logs using Page Object Model.

Required output style:

- Language: JavaScript.
- Pattern: POM - Page Object Model.
- Test readability: every meaningful group/action sequence must be wrapped with `test.step(...)`.
- Generated specs should call page object methods instead of placing all locator logic directly in the spec.

Already exists:

- Deterministic generator from Lane A action log contract.
- JavaScript spec output.
- Page Object Model output.
- `test.step(...)` wrapping for readable testcase steps.
- Selector priority: testId -> roleText -> id -> css -> xpath.
- Control support: text, textarea, select, radio, checkbox, click.
- Custom control support: Select2-like single select and multi-select checklist.
- Reviewer agent.
- Codex-ready adapter.
- Playwright config.
- Runtime validation loop.

Needs alignment later:

- Support CSV/data-driven loops.
- Support testcase input mode.
- Use Manual Analyst output.
- Store agent interaction logs.
- Generate from suite/merged flow contracts.

## Phase B4: Runtime Validation

Status: MVP implemented, future alignment needed

Goal:

- Execute generated Playwright tests and feed failures back to the generator/reviewer loop.

Already exists:

- Playwright test runner integration.
- Runtime validation command.
- Basic failure classification:
  - selector failure
  - assertion failure
  - runtime error
  - unknown failure
- Generation log includes runtime classification and artifact pointers.

Needs alignment later:

- Deeper failure classification from Playwright JSON result details.
- Trace/screenshot attachment policy.
- Integration with dashboard.

## Phase B5: Self-Healing

Status: Future

Goal:

- Heal selector failures only.

Planned:

- Detect locator timeout / element not found.
- Do not heal assertion/business failures.
- Capture DOM snapshot.
- Capture accessibility snapshot.
- Propose new selector.
- Validate selector:
  - exactly one element
  - visible
  - enabled when needed
- Patch only locator.
- Rerun Playwright.
- Log healing event.

Acceptance criteria:

- Intentional UI selector change causes test failure.
- Healing proposes valid replacement.
- Test reruns and passes.
- Healing event is logged.

## Phase F1: Dashboard

Status: Future

Goal:

- Show the full demo story visually.

Planned:

- Recorded test cases.
- Replay run history.
- CSV loop result.
- Generated automation history.
- Self-healing event log.
- Selector diff old/new.

## Phase F2: README and Customer Demo Package

Status: Future

Goal:

- Make the project easy to understand and demo.

Planned:

- Vietnamese README.
- English README.
- Short Japanese summary.
- Mermaid architecture diagram.
- Step-by-step demo script.
- Troubleshooting.
- Clear explanation of:
  - Lane A Manual QC Assistant
  - Lane B AI Automation Factory
  - extension recorder as primary recorder
  - Playwright scripted recorder as helper only
  - deterministic logic vs AI/Codex usage

## Phase F3: Portable Demo Package

Status: Future

Goal:

- Package the demo so it can be moved to another machine and run without losing saved flows.

Preferred approach:

- Start with a simple portable folder package.
- Later consider workspace export/import from the extension.

Planned simple package structure:

```text
demo-package/
  extension/
  public/
  src/
  logs/
    checkout-flow.json
    create-customer.json
  package.json
  README.md
  start-demo.bat
```

Expected usage on another machine:

1. Install Node.js.
2. Run `npm install`.
3. Run `start-demo.bat` or `npm start`.
4. Load Chrome extension from `demo-package/extension`.
5. Import action logs from `demo-package/logs/*.json`.

Implementation tasks:

- Add `scripts/create-demo-package.js`.
- Add `start-demo.bat`.
- Add `logs/README.md`.
- Document that `Download` creates portable action logs.
- Document that `Save Local` only writes to the current project folder.
- Optionally add a future `Export Workspace` / `Import Workspace` feature for one-file migration.

## Current Next Recommended Task

Prepare the next Lane C server-side security phase while keeping Lane A/B stable.

Recommended sequence:

1. Add an optional intentionally vulnerable local demo mode only if needed for fail-case demos.
2. Add more OWASP rules beyond the current local flow-based checks.
3. Keep API replay same-origin/local only unless an explicit allowlist is added.

## Decisions Already Made

- Prioritize Lane A first.
- Lane A is Manual QC Assistant.
- Lane B is AI Automation Factory and comes later.
- Use a local demo shop, not unauthorized third-party websites.
- Chrome extension is the primary recorder.
- Playwright scripted recorder is only a fixture/helper.
- Replay input overwrites existing value.
- Extension replay is quick validation only, not a replacement for Playwright runtime validation.
- Lane A MVP is complete and provides the stable recorder/replay/data/suite/report foundation.
- Exported action logs are the source contract for Lane B Playwright generation and self-healing.
- AI/Codex usage should be minimized by deterministic logic, cache, templates, and DOM filtering.
