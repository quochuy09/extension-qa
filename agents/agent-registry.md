# Agent Registry

## Current Priority

Lane A is the current priority: Manual QC Assistant.

Lane B agents are future scope and should not drive implementation until Lane A is stable.

All implementation work should follow:

- `agents/workflow-plan-review-implement-test.md`

## Lane A Agents

## Agent Implementation Planner

Role:

- Produce a plan before code changes.
- Identify affected modules, risks, assumptions, verification, and approval checkpoint.

Does not:

- Edit files.
- Implement code.

## Agent Plan Reviewer

Role:

- Review a proposed plan against project rules and architecture boundaries.
- Return blocking and non-blocking findings.

Does not:

- Implement code.
- Rewrite the plan directly.

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

- Convert business-analyzed actions into Playwright JavaScript and Page Object Model files.
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

## Lane C Agents

## Agent Security Planner

Role:

- Plan Lane C security automation phases.
- Identify whether work belongs to UI replay, rule expansion, request tampering, or report polish.

Does not:

- Edit files.
- Implement rules.

## Agent Security Plan Reviewer

Role:

- Review Lane C plans for scope, safety, OWASP mapping, and verification.

Does not:

- Implement rules.

## Agent Security Implementation Engineer

Role:

- Implement approved Lane C security changes.
- Maintain security runner, rules, payloads, reports, and focused docs.

Does not:

- Implement unrelated recorder/generator/self-healing work unless explicitly assigned in the approved plan.

## Agent Security Reviewer

Role:

- Review security findings, rules, severity, OWASP/CWE mapping, and report usefulness.
- Flag false-positive risk.

Does not:

- Rewrite implementation directly.

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
