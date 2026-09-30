import { getPool, closePool } from "./pool";
import { maitriBharatiSeedData } from "./seeds/maitri_bharati_seeds";
import { hashPassword } from "../auth/crypto";

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

    // 8. Asset Dependencies
    const { hardeningSeedData } = await import("./seeds/hardening_seeds");
    for (const dep of hardeningSeedData.dependencies) {
      await client.query(
        `
        INSERT INTO asset_dependencies (id, from_asset_id, to_asset_id, dependency_type, criticality, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          criticality = EXCLUDED.criticality,
          description = EXCLUDED.description;
      `,
        [
          dep.id,
          dep.fromAssetId,
          dep.toAssetId,
          dep.dependencyType,
          dep.criticality,
          dep.description ?? null,
          dep.createdAt ?? new Date(),
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.dependencies.length} asset dependencies.`);

    // 9. Metric Definitions
    for (const md of hardeningSeedData.metricDefinitions) {
      await client.query(
        `
        INSERT INTO metric_definitions (
          id, metric, canonical_unit, min_plausible, max_plausible,
          warning_threshold_low, warning_threshold_high,
          critical_threshold_low, critical_threshold_high,
          expected_sampling_interval_seconds, aggregation_strategy,
          allowed_asset_types, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          canonical_unit = EXCLUDED.canonical_unit,
          min_plausible = EXCLUDED.min_plausible,
          max_plausible = EXCLUDED.max_plausible,
          warning_threshold_low = EXCLUDED.warning_threshold_low,
          warning_threshold_high = EXCLUDED.warning_threshold_high,
          critical_threshold_low = EXCLUDED.critical_threshold_low,
          critical_threshold_high = EXCLUDED.critical_threshold_high,
          expected_sampling_interval_seconds = EXCLUDED.expected_sampling_interval_seconds,
          aggregation_strategy = EXCLUDED.aggregation_strategy,
          allowed_asset_types = EXCLUDED.allowed_asset_types;
      `,
        [
          md.id,
          md.metric,
          md.canonicalUnit,
          md.minPlausible,
          md.maxPlausible,
          md.warningThresholdLow ?? null,
          md.warningThresholdHigh ?? null,
          md.criticalThresholdLow ?? null,
          md.criticalThresholdHigh ?? null,
          md.expectedSamplingIntervalSeconds,
          md.aggregationStrategy,
          JSON.stringify(md.allowedAssetTypes),
          md.createdAt ?? new Date(),
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.metricDefinitions.length} metric definitions.`);

    // 10. Maintenance Events
    for (const me of hardeningSeedData.maintenanceEvents) {
      await client.query(
        `
        INSERT INTO maintenance_events (
          id, station_id, asset_id, maintenance_type, scheduled_at, completed_at, notes, parts_used, result, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          completed_at = EXCLUDED.completed_at,
          notes = EXCLUDED.notes,
          parts_used = EXCLUDED.parts_used,
          result = EXCLUDED.result;
      `,
        [
          me.id,
          me.stationId,
          me.assetId,
          me.maintenanceType,
          me.scheduledAt,
          me.completedAt ?? null,
          me.notes ?? null,
          JSON.stringify(me.partsUsed ?? []),
          me.result,
          me.createdAt ?? new Date(),
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.maintenanceEvents.length} maintenance events.`);

    // 11. Operators with secure scrypt password hash
    await client.query("DELETE FROM operators;");
    const defaultPasswordHash = hashPassword("antigravity2026");
    for (const op of hardeningSeedData.operators) {
      await client.query(
        `
        INSERT INTO operators (id, username, full_name, role, station_id, password_hash, email, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          station_id = EXCLUDED.station_id,
          password_hash = EXCLUDED.password_hash,
          email = EXCLUDED.email;
      `,
        [
          op.id,
          op.username,
          op.fullName,
          op.role,
          op.stationId ?? null,
          defaultPasswordHash,
          `${op.username}@antarctica.gov.in`,
          op.createdAt ?? new Date(),
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.operators.length} operators with authentication credentials.`);

    // 12. Audit Events
    for (const ae of hardeningSeedData.auditEvents) {
      await client.query(
        `
        INSERT INTO audit_events (
          id, operator_id, action, target_type, target_id, previous_state, new_state, result, correlation_id, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          result = EXCLUDED.result;
      `,
        [
          ae.id,
          ae.operatorId ?? null,
          ae.action,
          ae.targetType,
          ae.targetId ?? null,
          JSON.stringify(ae.previousState ?? {}),
          JSON.stringify(ae.newState ?? {}),
          ae.result,
          ae.correlationId ?? null,
          ae.createdAt ?? new Date(),
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.auditEvents.length} audit events.`);

    // 13. Cargo Missions
    for (const cm of hardeningSeedData.cargoMissions) {
      await client.query(
        `
        INSERT INTO cargo_missions (
          id, code, name, origin, destination_station_id, vessel_or_aircraft,
          status, departure_date, eta, eta_confidence_pct, max_payload_kg,
          current_payload_kg, weather_risk, delivery_buffer_days, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          eta = EXCLUDED.eta,
          eta_confidence_pct = EXCLUDED.eta_confidence_pct,
          current_payload_kg = EXCLUDED.current_payload_kg;
      `,
        [
          cm.id,
          cm.code,
          cm.name,
          cm.origin,
          cm.destinationStationId,
          cm.vesselOrAircraft,
          cm.status,
          cm.departureDate ?? null,
          cm.eta,
          cm.etaConfidencePct,
          cm.maxPayloadKg,
          cm.currentPayloadKg,
          cm.weatherRisk,
          cm.deliveryBufferDays,
          cm.createdAt,
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.cargoMissions.length} cargo missions.`);

    // 14. Cargo Requisitions
    for (const cr of hardeningSeedData.cargoRequisitions) {
      await client.query(
        `
        INSERT INTO cargo_requisitions (
          id, station_id, item_id, item_name, category, requested_quantity,
          unit, priority, status, reason, requested_by, approved_by, mission_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          requested_quantity = EXCLUDED.requested_quantity,
          priority = EXCLUDED.priority,
          approved_by = EXCLUDED.approved_by,
          mission_id = EXCLUDED.mission_id,
          updated_at = EXCLUDED.updated_at;
      `,
        [
          cr.id,
          cr.stationId,
          cr.itemId,
          cr.itemName,
          cr.category,
          cr.requestedQuantity,
          cr.unit,
          cr.priority,
          cr.status,
          cr.reason,
          cr.requestedBy,
          cr.approvedBy ?? null,
          cr.missionId ?? null,
          cr.createdAt,
          cr.updatedAt,
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.cargoRequisitions.length} cargo requisitions.`);

    // 15. Station Thresholds
    for (const st of hardeningSeedData.stationThresholds) {
      await client.query(
        `
        INSERT INTO station_thresholds (
          id, station_id, metric, warning_threshold_low, warning_threshold_high,
          critical_threshold_low, critical_threshold_high, updated_by, updated_at, comment
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          warning_threshold_low = EXCLUDED.warning_threshold_low,
          warning_threshold_high = EXCLUDED.warning_threshold_high,
          critical_threshold_low = EXCLUDED.critical_threshold_low,
          critical_threshold_high = EXCLUDED.critical_threshold_high,
          updated_at = EXCLUDED.updated_at;
      `,
        [
          st.id,
          st.stationId,
          st.metric,
          st.warningThresholdLow ?? null,
          st.warningThresholdHigh ?? null,
          st.criticalThresholdLow ?? null,
          st.criticalThresholdHigh ?? null,
          st.updatedBy,
          st.updatedAt,
          st.comment ?? null,
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.stationThresholds.length} station thresholds.`);

    // 16. Operational Mission Events
    for (const me of hardeningSeedData.missionEvents) {
      await client.query(
        `
        INSERT INTO mission_events (
          id, station_id, category, severity, title, description,
          source, provenance_type, zone, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          severity = EXCLUDED.severity;
      `,
        [
          me.id,
          me.stationId,
          me.category,
          me.severity,
          me.title,
          me.description,
          me.source,
          me.provenanceType,
          me.zone ?? null,
          JSON.stringify(me.metadata),
          me.createdAt,
        ]
      );
    }
    console.log(`[seed] Seeded ${hardeningSeedData.missionEvents.length} operational mission events.`);

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
