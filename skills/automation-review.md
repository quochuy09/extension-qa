# Skill: Automation Review

## Owner Agent

Agent Automation Reviewer

## Purpose

Review generated automation before runtime execution.

## Checklist

- No hard wait.
- Selector priority is respected.
- Assertions exist after business milestones.
- Test starts from a clean app state.
- Test can be rerun.
- Code is readable for customer-facing demo.

## Output

```json
{
  "approved": false,
  "findings": [
    {
      "id": "selector-priority",
      "severity": "medium",
      "message": "Use data-testid instead of css for login button."
    }
  ]
}
```

## Rules

- Review code quality, not business requirements.
- If runtime output is provided, include it in the findings.
- Approval means the code is ready to run, not guaranteed to pass.
