# Agent Interaction Contract

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
