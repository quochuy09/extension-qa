# Skill: CSV Data Loop

## Owner Agent

Agent Data Loop Engineer

## Purpose

Add CSV-driven repetition to the Manual QC Assistant.

## Responsibilities

- Import CSV files in the extension.
- Parse CSV into columns and rows.
- Preview dataset rows.
- Bind CSV columns to recorded input steps.
- Replace recorded input values with dataset row values during replay.
- Run a recorded flow once per CSV row.
- Produce row-level pass/fail replay results.
- Enforce a demo-safe maximum loop count.
- Stop on the first failed row for the MVP.

## Rules

- Do not require AI for CSV replay.
- Unbound input steps must keep their recorded values.
- Click steps must remain unchanged.
- CSV data should stay local in extension storage unless the user exports/saves it.
- Failed rows should report failed step description and reason.
- Phase A2 max row count is 100.

## Future Extensions

- JSON dataset import.
- Generated fake data.
- Conditional data rules.
- Multi-dataset bindings.
