import { getPool, closePool } from "./pool";
import { maitriBharatiSeedData } from "./seeds/maitri_bharati_seeds";

export async function runSeeds(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log("[seed] Starting database seeding...");
    await client.query("BEGIN");

    // 1. Stations
    for (const s of maitriBharatiSeedData.stations) {
      await client.query(
        `
        INSERT INTO stations (id, code, name, location_label, status, data_mode, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          location_label = EXCLUDED.location_label,
          status = EXCLUDED.status,
          data_mode = EXCLUDED.data_mode,
          updated_at = NOW();
      `,
        [s.id, s.code, s.name, s.locationLabel, s.status, s.dataMode]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.stations.length} stations.`);

    // 2. Assets (insert top-level assets first, then child assets)
    const topLevelAssets = maitriBharatiSeedData.assets.filter((a) => !a.parentAssetId);
    const childAssets = maitriBharatiSeedData.assets.filter((a) => a.parentAssetId);

    for (const a of [...topLevelAssets, ...childAssets]) {
      await client.query(
        `
        INSERT INTO assets (id, station_id, parent_asset_id, code, name, type, status, criticality, health_score, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          parent_asset_id = EXCLUDED.parent_asset_id,
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          criticality = EXCLUDED.criticality,
          health_score = EXCLUDED.health_score,
          updated_at = NOW();
      `,
        [
          a.id,
          a.stationId,
          a.parentAssetId ?? null,
          a.code,
          a.name,
          a.type,
          a.status,
          a.criticality,
          a.healthScore,
        ]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.assets.length} assets.`);

    // 3. Telemetry
    for (const t of maitriBharatiSeedData.telemetry) {
      await client.query(
        `
        INSERT INTO telemetry_points (id, station_id, asset_id, metric, value, unit, timestamp, source, quality)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          value = EXCLUDED.value,
          quality = EXCLUDED.quality;
      `,
        [t.id, t.stationId, t.assetId, t.metric, t.value, t.unit, t.timestamp, t.source, t.quality]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.telemetry.length} telemetry points.`);

    // 4. Inventory
    for (const inv of maitriBharatiSeedData.inventory) {
      await client.query(
        `
        INSERT INTO inventory_items (id, station_id, category, name, quantity, unit, minimum_threshold, average_daily_consumption, lead_time_days, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          minimum_threshold = EXCLUDED.minimum_threshold,
          average_daily_consumption = EXCLUDED.average_daily_consumption,
          lead_time_days = EXCLUDED.lead_time_days,
          updated_at = NOW();
      `,
        [
          inv.id,
          inv.stationId,
          inv.category,
          inv.name,
          inv.quantity,
          inv.unit,
          inv.minimumThreshold,
          inv.averageDailyConsumption,
          inv.leadTimeDays,
        ]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.inventory.length} inventory items.`);

    // 5. Alerts
    for (const al of maitriBharatiSeedData.alerts) {
      await client.query(
        `
        INSERT INTO alerts (id, station_id, asset_id, severity, category, title, description, evidence, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          evidence = EXCLUDED.evidence;
      `,
        [
          al.id,
          al.stationId,
          al.assetId ?? null,
          al.severity,
          al.category,
          al.title,
          al.description,
          JSON.stringify(al.evidence),
          al.status,
        ]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.alerts.length} alerts.`);

    // 6. Forecasts
    for (const fc of maitriBharatiSeedData.forecasts) {
      await client.query(
        `
        INSERT INTO forecasts (id, station_id, target, horizon_hours, predicted_value, lower_bound, upper_bound, model_version, generated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          predicted_value = EXCLUDED.predicted_value,
          lower_bound = EXCLUDED.lower_bound,
          upper_bound = EXCLUDED.upper_bound;
      `,
        [
          fc.id,
          fc.stationId,
          fc.target,
          fc.horizonHours,
          fc.predictedValue,
          fc.lowerBound,
          fc.upperBound,
          fc.modelVersion,
          fc.generatedAt,
        ]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.forecasts.length} forecasts.`);

    // 7. Simulations
    for (const sim of maitriBharatiSeedData.simulations) {
      await client.query(
        `
        INSERT INTO simulation_runs (id, station_id, scenario_type, input_state, output_state, impacts)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          output_state = EXCLUDED.output_state,
          impacts = EXCLUDED.impacts;
      `,
        [
          sim.id,
          sim.stationId,
          sim.scenarioType,
          JSON.stringify(sim.inputState),
          JSON.stringify(sim.outputState),
          JSON.stringify(sim.impacts),
        ]
      );
    }
    console.log(`[seed] Seeded ${maitriBharatiSeedData.simulations.length} simulation runs.`);

    await client.query("COMMIT");
    console.log("[seed] All seeds executed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seed] Seeding failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow running directly via CLI
if (require.main === module) {
  runSeeds()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
