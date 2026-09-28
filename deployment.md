# Deployment

## Local development

Use Docker Compose for:

- PostgreSQL/TimescaleDB
- MQTT broker
- backend
- frontend
- ML service
- optional Ollama

## Suggested services

```text
web
api
ml
db
mqtt
ollama
```

## Environment variables

Create `.env.example` containing placeholders such as:

```text
DATABASE_URL=
MQTT_URL=
JWT_SECRET=
OLLAMA_BASE_URL=
ML_SERVICE_URL=
```

Never commit actual values.

## Startup

Preferred:

```bash
docker compose up --build
```

## Health endpoints

```http
GET /health
GET /ready
```

`/health` checks process health.

`/ready` checks required dependencies.

## Demo resilience

The application should still start if Ollama is unavailable.

In that case:
- hide or disable LLM features gracefully
- keep Twin/dashboard/analytics working

## Production direction

For a future deployment:

```text
Edge gateway
   ↓
secure message channel
   ↓
central ingestion
   ↓
Twin/data platform
   ↓
operator console
```

Keep the architecture compatible with intermittent connectivity.
