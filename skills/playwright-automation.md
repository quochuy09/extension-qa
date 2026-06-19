# Skill: Playwright Automation

## Owner Agent

Agent QA Automation Engineer

## Purpose

Generate maintainable Playwright TypeScript tests from business-analyzed action logs.

## Inputs

- Action log JSON.
- QA Manual Analyst output.
- Reviewer feedback.
- Runtime feedback.

## Responsibilities

- Generate Playwright test code.
- Use `test.step` for business groups.
- Use stable locators.
- Add meaningful assertions.
- Keep tests deterministic and idempotent.
- Convert fixed-count repeat groups into clear Playwright loops.

## Locator Priority

1. `data-testid`
2. role + accessible name
3. css
4. xpath

## Hard Rules

- Do not use `waitForTimeout`.
- Do not hide runtime failures.
- Do not use xpath unless no better selector exists.
- Do not generate healing logic inside the test spec.
- Do not generate dataset-driven loops until the action log includes explicit dataset bindings.
