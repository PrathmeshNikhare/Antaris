# Acceptance Criteria

## Foundation

- [ ] Fresh checkout can start using documented commands.
- [ ] Database migrations work.
- [ ] Seed data creates Maitri and Bharati.
- [ ] Typecheck passes.
- [ ] Lint passes.

## Twin

- [ ] Both stations have digital state.
- [ ] Assets are represented.
- [ ] Telemetry updates Twin state.
- [ ] Twin retains provenance.
- [ ] Station status is derived consistently.

## Monitoring

- [ ] Infrastructure screen works.
- [ ] Energy screen works.
- [ ] Logistics screen works.
- [ ] Environment screen works.
- [ ] Alerts work.

## AI

- [ ] Anomaly detector works on fixture data.
- [ ] Energy forecast returns a valid result.
- [ ] Inventory/fuel forecast works.
- [ ] AI outputs have timestamps/version.
- [ ] Evidence is visible.

## Simulation

- [ ] At least one failure scenario works.
- [ ] Baseline is not mutated.
- [ ] Scenario result is reproducible.
- [ ] UI clearly labels simulated results.

## LLM

- [ ] LLM can read station summary.
- [ ] LLM can explain an alert.
- [ ] LLM can answer an energy question.
- [ ] LLM cannot directly mutate the Twin.
- [ ] Application works when LLM is unavailable.

## UI

- [ ] Desktop command-center layout.
- [ ] Visual system follows ui-ux.md.
- [ ] No generic AI dashboard styling.
- [ ] Loading/error/empty states exist.
- [ ] Color is not the only status indicator.

## Demo

- [ ] End-to-end anomaly story works.
- [ ] Cross-domain effect is visible.
- [ ] What-if scenario works.
- [ ] Maitri/Bharati switching works.
