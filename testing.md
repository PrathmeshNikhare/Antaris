# Testing Strategy

## Unit tests

Test:

- unit conversion
- telemetry validation
- energy calculations
- inventory depletion
- station status
- asset health
- alert rules
- simulation calculations

## Integration tests

Test:

```text
MQTT → ingestion → database → Twin
```

and:

```text
API → service → database
```

## ML tests

Use deterministic fixture datasets.

Test:

- expected anomaly is detected
- normal series is not over-flagged
- forecast endpoint returns valid schema
- model version is returned

Do not assert unrealistic model perfection.

## Frontend tests

Test:

- station switching
- alert acknowledgement
- dashboard loading
- empty states
- error states
- realtime update

## E2E

At minimum:

1. Open dashboard.
2. Select Maitri.
3. See live telemetry.
4. Inject anomaly.
5. Alert appears.
6. Open alert.
7. Inspect affected asset.
8. Run what-if simulation.
9. Compare baseline/scenario.
10. Ask LLM a read-only question.

## Quality gate

Before a phase is marked complete:

```text
npm test
npm run lint
npm run typecheck
npm run build
```

and Python tests where applicable.
