# AI / ML Layer

## Guiding principle

Use AI where it provides prediction, detection or reasoning value. Use deterministic rules where rules are clearer.

## Model 1 — Anomaly detection

Initial candidate:

- Isolation Forest

Features can include:

- temperature
- power
- vibration
- runtime
- efficiency
- rolling mean
- rolling standard deviation

Output:

```json
{
  "assetId": "GEN-01",
  "metric": "temperature",
  "anomalyScore": 0.94,
  "isAnomaly": true,
  "modelVersion": "iforest-v1",
  "generatedAt": "..."
}
```

## Model 2 — Energy forecasting

Start with:

- baseline moving average
- XGBoost/regression

Features:

- hour
- day
- temperature
- wind
- recent consumption
- recent generation
- load state

Output:

- forecast
- horizon
- lower/upper bound
- model version

## Model 3 — Inventory/fuel forecast

Start with a hybrid:

```text
forecast consumption
+
current inventory
+
minimum reserve
+
lead time
```

Use ML only if historical data supports it.

## Model 4 — Asset health

Health score can combine:

```text
temperature trend
+ anomaly frequency
+ efficiency trend
+ runtime
+ maintenance age
```

This is a risk indicator, not a guaranteed probability of failure.

## Model 5 — Cross-domain risk

Build a transparent rule/score engine first.

Example:

```text
weather risk
+ energy reserve risk
+ asset risk
+ logistics risk
→ operational risk
```

Every risk result should expose contributing factors.

## LLM

Use Ollama-compatible local models.

The LLM should call tools such as:

- get_station_summary
- get_asset_status
- get_alerts
- get_energy_trend
- get_energy_forecast
- get_inventory_status
- run_simulation
- get_environment_summary

The LLM should receive structured results and formulate an answer.

## LLM prompt requirements

The system prompt must say:

- use only tool results for station facts
- distinguish simulated from measured data
- mention timestamps where useful
- say when data is unavailable
- never invent values
- never issue physical commands
- recommendations are advisory

## AI observability

Store:

- model name/version
- input timestamp
- output timestamp
- confidence/score where available
- input feature summary
- result
- explanation/evidence
