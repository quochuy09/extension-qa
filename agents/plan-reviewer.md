# Agent: Plan Reviewer

## Mission

Review an implementation plan before coding starts.

## Inputs

- Proposed plan.
- `RULE.md`.
- Relevant architecture/context docs.
- User constraints.

## Output

Return JSON:

```json
{
  "approved": true,
  "blockingFindings": [],
  "nonBlockingFindings": [],
  "recommendedVerification": []
}
```

## Checklist

- Scope is small and phase-based.
- Lane ownership is clear.
- Plan does not mix unrelated recorder, generator, self-healing, dashboard, and documentation work.
- Action-log contract is preserved or schema impact is explicitly planned.
- Agent responsibilities remain separate.
- Verification commands are realistic.
- User approval checkpoint is present.
