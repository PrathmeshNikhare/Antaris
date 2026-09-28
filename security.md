# Security and Safety

## Authentication

Use authenticated sessions/tokens for the application.

## Authorization

Suggested roles:

- ADMIN
- OPERATOR
- ENGINEER
- LOGISTICS
- VIEWER

Enforce station/domain access server-side.

## Audit

Record:

- user
- timestamp
- action
- target
- previous state
- new state
- result

## LLM safety

The LLM is read-only by default.

It must not:
- write directly to the DB
- execute shell commands
- access arbitrary files
- bypass API authorization
- fabricate telemetry
- claim a simulation is a real event

## Command safety

Prototype commands are simulated.

A future physical-control implementation must add:

- authorization
- interlocks
- command validation
- two-person approval where appropriate
- hardware acknowledgement
- rollback/fail-safe behavior

## Secrets

Never commit:

- API keys
- passwords
- database credentials
- model credentials

Use `.env` and `.env.example`.

## Input validation

Validate all:
- HTTP input
- MQTT payloads
- WebSocket messages
- simulation parameters
- LLM tool arguments
