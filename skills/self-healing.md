# Skill: Self-Healing

## Owner Agent

Agent Self-Healing Engineer

## Purpose

Repair selector failures caused by UI locator changes.

## Inputs

- Failed test code.
- Old selector.
- Failure stack trace.
- Current DOM snapshot.
- Accessibility snapshot.
- Original action log selector candidates.

## Responsibilities

- Classify whether the failure is a selector failure.
- Propose a replacement selector.
- Validate the replacement selector in Playwright.
- Patch only the locator.
- Record a healing event.

## Validation Rules

A proposed selector is acceptable only if:

- it resolves exactly one element
- the element is visible
- the element is enabled when an action needs interaction
- the element matches the original action intent

## Hard Rules

- Do not self-heal failed business assertions.
- Do not rewrite test logic.
- Do not patch multiple unrelated locators in one event.
- Do not accept a selector that matches multiple elements.
