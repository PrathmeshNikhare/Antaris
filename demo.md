# SIH Demo Script

## Goal

Show that the system can observe, understand and simulate station operations.

## Scene 1 — Command center

Open Overview.

Show:

- Maitri status
- Bharati status
- connectivity
- last sync
- energy
- logistics
- environment
- alerts

## Scene 2 — Digital Twin

Open Maitri Twin.

Click:

`GEN-01`

Show:

- current temperature
- power
- fuel
- health
- last update
- recent trend

## Scene 3 — Inject anomaly

Use demo control:

`Increase GEN-01 temperature`

Show telemetry moving upward.

The alert appears.

## Scene 4 — AI explanation

Open Intelligence.

Show:

- anomaly score
- evidence
- affected asset
- likely contributing indicators

Do not claim an exact physical diagnosis unless the data supports it.

## Scene 5 — Cross-domain impact

Show:

```text
Generator degradation
→ energy efficiency decreases
→ fuel consumption increases
→ depletion forecast changes
→ logistics risk increases
```

## Scene 6 — What-if

Run:

`Generator GEN-01 failure`

Show baseline vs scenario.

## Scene 7 — LLM

Ask:

> What is the most important issue at Maitri right now?

The assistant should answer from tool results.

Then ask:

> Why is the energy risk increasing?

It should cite the relevant telemetry/forecast evidence.

## Scene 8 — Bharati

Switch to Bharati and demonstrate that the same framework works for another station without duplicating application logic.

## Demo rule

Prefer one coherent operational story over showing every feature.
