# Agent Registry

## Current Priority

Lane A is the current priority: Manual QC Assistant.

Lane B agents are future scope and should not drive implementation until Lane A is stable.

## Lane A Agents

## Agent Recorder Engineer

Primary skill:

- Recorder Extension

Role:

- Build Chrome extension recorder.
- Maintain selector extraction.
- Maintain readable step generation.
- Maintain replay engine.
- Ensure action log quality.

## Agent Data Loop Engineer

Primary skill:

- CSV Data Loop

Role:

- Add CSV import.
- Add dataset preview.
- Add input-step binding.
- Run flow by CSV rows.
- Produce row-level replay results.

## Lane B Agents

## Agent QA Manual Analyst

Primary skill:

- Manual QA Analysis

Role:

- Understand the recorded user flow.
- Convert raw actions into business intent.
- Define expected checkpoints.

Does not:

- Generate Playwright code.
- Patch test files.

## Agent QA Automation Engineer

Primary skill:

- Playwright Automation

Role:

- Convert business-analyzed actions into Playwright TypeScript.
- Use selector priority rules.
- Incorporate reviewer/runtime feedback.

Does not:

- Approve its own code.
- Self-heal failed tests.

## Agent Automation Reviewer

Primary skill:

- Automation Review

Role:

- Review generated code against checklist.
- Return structured findings.
- Approve or reject.

Does not:

- Rewrite code directly.

## Agent Runtime Validator

Primary skill:

- Runtime Validation

Role:

- Run Playwright tests.
- Capture stdout/stderr.
- Classify high-level result.
- Send selector failures to self-healing.

Does not:

- Change generated code.

## Agent Self-Healing Engineer

Primary skill:

- Self-Healing

Role:

- Repair selector failures only.
- Validate replacement selectors.
- Patch only locators.
- Log healing events.

Does not:

- Change business assertions.
- Mask real product bugs.
