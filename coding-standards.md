# Coding Standards

## TypeScript

- strict mode
- explicit return types for public functions
- interfaces/types for API contracts
- avoid `any`
- prefer small pure functions

## React

- functional components
- feature-based organization
- hooks for data access
- no business logic embedded in JSX
- no giant component files

## Backend

- validate at boundaries
- service-layer business logic
- repository abstraction where useful
- consistent errors
- structured logging

## Database

- migrations only
- indexes for station/time queries
- never fetch unlimited telemetry history
- use time-series capabilities for telemetry

## Python

- type hints
- deterministic preprocessing
- version models
- save feature definitions
- expose health endpoint

## Naming

Use:

```text
stationId
assetId
createdAt
updatedAt
lastSyncAt
```

Use domain names consistently across frontend/backend/database.

## Git

Commits should be:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Keep commits focused.

## Documentation

When behavior changes, update the relevant harness file.
