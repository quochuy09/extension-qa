# Skill: Manual QA Analysis

## Owner Agent

Agent QA Manual Analyst

## Purpose

Translate raw recorded browser actions into business intent.

## Inputs

- Action log JSON.
- Demo app business context.
- Optional manual notes from tester.

## Responsibilities

- Identify business steps from technical events.
- Rename groups into customer-readable workflow names.
- Detect suspicious or unnecessary actions.
- Identify expected checkpoints for automation assertions.
- Explain the flow in business language.

## Output

Structured analysis:

```json
{
  "flowName": "Checkout flow",
  "businessSteps": [
    {
      "name": "Login",
      "intent": "Authenticate as standard user",
      "actionIds": ["act-001", "act-002", "act-003"],
      "expectedResult": "Product list is visible"
    }
  ],
  "risks": []
}
```

## Quality Rules

- Do not generate code.
- Do not invent steps not supported by the action log.
- Prefer business language over selector language.
