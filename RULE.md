# Project Rules

## Purpose

This file defines the working rules for building the Self-Healing Test Automation Factory demo.

The goal is to keep the project clear, explainable, and customer-demo ready.

## Collaboration Rules

1. Always analyze before coding.
   - Clarify the goal.
   - Identify affected files/modules.
   - Explain the intended approach.
   - Point out risks or assumptions.

2. Do not code without explicit approval.
   - For each new phase or meaningful implementation change, propose the plan first.
   - Wait for confirmation before editing code.
   - Small documentation updates requested directly by the user can be made immediately.

3. Ask when uncertain.
   - If requirements are ambiguous, ask instead of guessing.
   - If multiple technical directions are possible, explain tradeoffs and ask for the preferred direction.
   - Do not silently choose an architecture that changes the demo story.
   - When asking a clarification question, include concrete options for the user to choose from.
   - Include a recommended option and explain why it is recommended.
   - Avoid open-ended questions when the decision can be framed as 2-3 practical choices.

4. Keep scope phase-based.
   - Finish one phase before moving to the next.
   - Stop and ask for confirmation after each phase.
   - Do not mix recorder, generator, self-healing, dashboard, and README work unless explicitly approved.

5. Be transparent about what is real and what is a helper.
   - Chrome extension recorder is the primary recorder.
   - Playwright scripted recording is only a fixture/helper.
   - Do not present hard-coded sample flows as real user recording.

## Architecture Rules

1. Recorder-first design.
   - Manual QA actions should be captured by the Chrome extension.
   - The recorder must export a structured action log.
   - The action log is the contract between recording and AI generation.

2. Agent responsibilities must stay separate.
   - Agent QA Manual Analyst analyzes business intent.
   - Agent QA Automation Engineer generates Playwright code.
   - Agent Automation Reviewer reviews generated code.
   - Agent Runtime Validator runs tests and classifies failures.
   - Agent Self-Healing Engineer repairs selector failures only.

3. Do not collapse all logic into one agent.
   - Each agent must have its own role, input, output, and skill.
   - Agent interaction should be logged or explainable.

4. Keep the demo safe.
   - Test only the local demo app or authorized targets.
   - Do not build workflows that scrape or test third-party sites without permission.

## Recorder Rules

1. Capture real user actions.
   - click
   - input/change
   - navigation context
   - target text
   - target tag

2. Store multiple selector candidates for each element.
   - `data-testid`
   - `id`
   - role + accessible name
   - css
   - relative xpath

3. Deduplicate noise.
   - Remove consecutive duplicate actions on the same element.
   - Preserve the final meaningful input value.

4. Group actions by business context.
   - Login
   - Product Selection
   - Cart
   - Checkout
   - Confirmation

5. Support repeatable groups.
   - Phase 1A must support marking a group as repeatable.
   - Phase 1A must support a fixed loop count.
   - Dataset-driven repeat is future scope unless explicitly approved.

6. Preserve screen flow context.
   - Recorded actions should keep enough URL/screen/group information for agents to understand navigation across screens.
   - Do not flatten meaningful screen transitions into anonymous actions only.

7. Treat extension replay as quick validation only.
   - Replay Step, Replay Group, and Replay All run in the current browser tab.
   - Replay depends on the current screen state.
   - Replay does not replace Playwright runtime validation.
   - Replay failures should not be treated as self-healing events unless a later phase explicitly wires that flow.

## Automation Generation Rules

1. Generated tests must be readable.
   - Use `test.step` for business groups.
   - Use meaningful test names.
   - Keep generated code easy for customers to inspect.

2. Locator priority:
   - `data-testid`
   - role + accessible name
   - css
   - xpath

3. Do not use hard waits.
   - `waitForTimeout` is not allowed.
   - Prefer Playwright auto-waiting and assertions.

4. Add assertions.
   - Assert after important business milestones.
   - Do not rely only on final confirmation.

5. Validate by real execution.
   - Text review is not enough.
   - Generated tests must run through Playwright test runner.

## Self-Healing Rules

1. Heal only selector failures.
   - Locator timeout.
   - Element not found.
   - Broken selector caused by UI locator changes.

2. Do not heal business failures.
   - Wrong expected text.
   - Wrong cart total.
   - Missing confirmation caused by product behavior.
   - These must be reported to a human.

3. Validate replacement selectors before patching.
   - Selector resolves exactly one element.
   - Element is visible.
   - Element is enabled when interaction is required.
   - Element matches the original action intent.

4. Patch only the locator.
   - Do not rewrite test logic.
   - Do not change assertions.
   - Do not hide failures.

5. Log every healing event.
   - timestamp
   - failed test
   - old selector
   - new selector
   - reason
   - validation result
   - processing time

## Documentation Rules

1. Keep context files updated when architecture changes.
2. README must clearly separate:
   - what is implemented
   - what is demo helper
   - what is planned
3. Customer-facing documentation should be professional and concise.
4. Final README should include Vietnamese, English, and a short Japanese summary.

## Quality Rules

1. Prefer simple, inspectable code over over-engineering.
2. Keep logs and reports readable.
3. Avoid unrelated refactors.
4. Do not introduce new dependencies without a clear reason.
5. Run relevant verification after implementation.
