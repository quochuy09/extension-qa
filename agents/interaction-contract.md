# Agent Interaction Contract

## Standard Implementation Workflow

For new implementation phases:

```text
Implementation Planner
-> Plan Reviewer
-> Domain Engineer
-> Domain Reviewer
-> Runtime Validator
```

Use `agents/workflow-plan-review-implement-test.md` as the detailed workflow contract.

## Current Lane A Contract

```mermaid
sequenceDiagram
  participant QC as Manual QC
  participant Ext as Chrome Extension
  participant Recorder as Recorder Engine
  participant Replay as Replay Engine
  participant Data as CSV Data Loop

  QC->>Ext: Start recording
  Ext->>Recorder: Capture actions
  Recorder->>Ext: Readable steps + selectors
  QC->>Replay: Run step/group/all
  Replay-->>QC: Replay result
  QC->>Data: Import CSV and bind columns
  Data->>Replay: Run flow per CSV row
  Replay-->>QC: Row-level result
```

## Future Lane B Contract

## Flow

```mermaid
sequenceDiagram
  participant QA as Manual QA
  participant Recorder as Recorder Extension
  participant Manual as Agent QA Manual Analyst
  participant Auto as Agent QA Automation Engineer
  participant Review as Agent Automation Reviewer
  participant Runtime as Agent Runtime Validator
  participant Heal as Agent Self-Healing Engineer

  QA->>Recorder: Perform business flow
  Recorder->>Manual: action-log.json
  Manual->>Auto: business flow analysis
  Auto->>Review: generated Playwright spec
  Review-->>Auto: findings or approval
  Auto->>Runtime: approved spec
  Runtime-->>Auto: runtime failure feedback if test fails
  Runtime->>Heal: selector failure only
  Heal->>Runtime: validated locator patch
```

## Data Contracts

### Recorder To Manual Analyst

- `logs/action-log.json`

### Manual Analyst To Automation Engineer

- business step list
- expected result per step
- suspicious action list
- repeatable group intent
- loop count guidance

### Automation Engineer To Reviewer

- generated Playwright spec
- generation notes

### Reviewer To Automation Engineer

- approved flag
- structured findings

### Runtime Validator To Automation Engineer

- command
- exit code
- stdout/stderr summary
- failed file and line when available

### Runtime Validator To Self-Healing Engineer

- failure type
- old selector
- failed code line
- DOM snapshot
- accessibility snapshot
- original action context

### Self-Healing Engineer To Runtime Validator

- old selector
- new selector
- validation result
- patch diff
- healing event log entry

## Lane C Security Contract

```mermaid
sequenceDiagram
  participant Planner as Security Planner
  participant PlanReview as Security Plan Reviewer
  participant SecEng as Security Implementation Engineer
  participant SecReview as Security Reviewer
  participant Runtime as Runtime Validator

  Planner->>PlanReview: Lane C plan
  PlanReview-->>Planner: approval/findings
  Planner->>SecEng: approved plan
  SecEng->>SecReview: security rules/findings/report changes
  SecReview-->>SecEng: approval/findings
  SecEng->>Runtime: verification commands
  Runtime-->>Planner: pass/fail classification
```

### Security Planner To Security Implementation Engineer

- approved phase
- target checks/rules
- affected files
- acceptance criteria
- verification commands

### Security Implementation Engineer To Security Reviewer

- changed rules
- finding format
- OWASP/CWE mapping
- report output examples

### Security Reviewer To Runtime Validator

- approved verification set
- expected pass/fail behavior

### Runtime Validator To Security Planner

- command results
- failing rule or test name
- artifacts such as `artifacts/security-report.html`
