# Frontend Implementation Contract

## Structure

Suggested:

```text
apps/web/
  src/
    app/
    components/
    features/
      overview/
      twin/
      infrastructure/
      energy/
      logistics/
      environment/
      intelligence/
      simulations/
    hooks/
    lib/
    styles/
    types/
```

## Rules

- Components should represent UI concepts, not API endpoints.
- Data fetching belongs in feature hooks/services.
- Realtime subscriptions belong in dedicated hooks.
- Charts must receive typed data.
- Use skeletons for initial loads.
- Provide meaningful empty/error states.
- Never hide API failures.

## Main pages

```text
/overview
/twin
/infrastructure
/energy
/logistics
/environment
/intelligence
/simulations
/reports
```

## Overview

The first screen should resemble a remote operations dashboard, not a landing page.

Must contain:

- station selector
- operational status
- sync/connectivity state
- 4-domain summary
- active alerts
- Twin preview
- energy trend
- AI insights

## Realtime behavior

When telemetry changes:

```text
WebSocket event
  → feature store/hook
  → update affected component
```

Do not refetch the entire dashboard on every sensor message.

## Accessibility

- keyboard navigation
- visible focus
- semantic buttons
- sufficient contrast
- charts with textual summaries
- do not rely only on color
