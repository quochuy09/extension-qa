# Skill: Recorder Extension

## Owner Agent

Agent Recorder Engineer

## Purpose

Build and maintain the Chrome extension that supports manual QC recording and replay.

## Responsibilities

- Capture click/input/change events.
- Extract stable selector candidates.
- Store raw actions locally.
- Export structured action log JSON.
- Support Start/Stop/Clear/Export controls.
- Show recorded steps in realtime.
- Generate readable manual testcase-style step descriptions.
- Support test case name.
- Support screen/group context.
- Allow a group to be marked repeatable.
- Allow a fixed loop count per repeatable group.
- Replay step, group, and all steps in the current browser tab.
- Show replay narration for manual testers.
- Keep the extension scoped to the local demo app.

## Technical Notes

- Use Manifest V3.
- Use a content script for page event capture.
- Use a popup for recorder controls.
- Use `chrome.storage.local` for temporary event storage.
- Keep selector extraction shared or aligned with the Node recorder.
- Phase 1A supports fixed-count repeat only.
- Dataset-driven loops should be added in a later phase.

## Output

- `extension/manifest.json`
- `extension/content/recorder.js`
- `extension/popup/popup.html`
- `extension/popup/popup.js`
- exported `action-log.json`
