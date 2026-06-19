# Skill: Runtime Validation

## Owner Agent

Agent Runtime Validator

## Purpose

Run generated Playwright tests and convert real runtime output into structured feedback.

## Inputs

- Generated Playwright spec.
- Playwright config.
- Runtime command output.

## Responsibilities

- Execute Playwright test runner.
- Store pass/fail history.
- Capture failed file, line, and error message.
- Classify failures at a high level.
- Route selector failures to self-healing.
- Route assertion/business failures to human review.

## Failure Classification

Selector failure examples:

- locator timeout
- element not found
- strict mode violation for a locator candidate

Business failure examples:

- expected text mismatch
- wrong cart total
- order confirmation not shown after valid actions

## Rules

- Do not patch code.
- Do not silently retry forever.
- Do not send business assertion failures to self-healing.
