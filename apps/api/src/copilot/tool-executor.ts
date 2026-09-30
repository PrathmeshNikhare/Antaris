/**
 * Phase 7 — Copilot Tool Executor
 *
 * Maps each approved tool name → existing internal service.
 * Every tool call is:
 *   - read-only
 *   - against in-memory Digital Twin or existing API data
 *   - returns structured JSON with provenance metadata
 */

import type { AllowedToolName } from "./tool-definitions";
import { ALLOWED_TOOLS } from "./tool-definitions";
import { getTwinRegistry } from "../twin/registry";
import { intelligenceService } from "../intelligence";
import { simulationStore } from "../simulation";
import { StationRepository, AssetRepository, AlertRepository } from "../repositories";
import { AuditRepository } from "../repositories";

export interface ToolResult {
  toolName: string;
  success: boolean;
  data: unknown;
  provenance: {
    source: "DIGITAL_TWIN" | "INTELLIGENCE_ENGINE" | "SIMULATION_ENGINE" | "DATABASE";
    dataType: "MEASURED" | "SIMULATED" | "COMPUTED" | "HISTORICAL";
    timestamp: string;
    disclaimer?: string;
  };
  error?: string;
}

// ── Repositories (lazy-initialized) ──────────────────────────────────
let stationRepo: StationRepository;
let assetRepo: AssetRepository;
let alertRepo: AlertRepository;
let auditRepo: AuditRepository;

function getRepos(): { stationRepo: StationRepository; assetRepo: AssetRepository; alertRepo: AlertRepository; auditRepo: AuditRepository } {
  if (!stationRepo) stationRepo = new StationRepository();
  if (!assetRepo) assetRepo = new AssetRepository();
  if (!alertRepo) alertRepo = new AlertRepository();
  if (!auditRepo) auditRepo = new AuditRepository();
  return { stationRepo, assetRepo, alertRepo, auditRepo };
}

// ── Default station helper ───────────────────────────────────────────
function resolveStation(args: Record<string, unknown>): string {
  return (args.stationId as string) || "station-maitri";
}

// ── Tool Executor ────────────────────────────────────────────────────
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Security: reject any tool not in the whitelist
  if (!ALLOWED_TOOLS.includes(toolName as AllowedToolName)) {
    return {
      toolName,
      success: false,
      data: null,
      provenance: {
        source: "DIGITAL_TWIN",
        dataType: "COMPUTED",
        timestamp: new Date().toISOString(),
      },
      error: `Tool '${toolName}' is not in the approved tool list. Only read-only station operations tools are allowed.`,
    };
  }

  try {
    const result = await executeApprovedTool(toolName as AllowedToolName, args);
    return result;
  } catch (err) {
    return {
      toolName,
      success: false,
      data: null,
      provenance: {
        source: "DIGITAL_TWIN",
        dataType: "COMPUTED",
        timestamp: new Date().toISOString(),
      },
      error: `Tool execution failed: ${(err as Error).message}`,
    };
  }
}

async function executeApprovedTool(
  toolName: AllowedToolName,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const now = new Date().toISOString();

  switch (toolName) {
    // ── Station Summary ──────────────────────────────────────────
    case "get_station_summary": {
      const stationId = resolveStation(args);
      const registry = getTwinRegistry();
      await registry.init();
      const twinState = registry.getTwinState(stationId);

      if (!twinState) {
        // Fallback to DB
        const repos = getRepos();
        const station = await repos.stationRepo.findById(stationId);
        const assets = station ? await repos.assetRepo.findByStationId(stationId) : [];
        const alerts = station ? await repos.alertRepo.findByStationId(stationId, "OPEN") : [];

        return {
          toolName,
          success: !!station,
          data: station
            ? {
                stationId,
                name: station.name,
                status: station.status,
                totalAssets: assets.length,
                operationalAssets: assets.filter((a) => a.status === "OPERATIONAL").length,
                degradedAssets: assets.filter((a) => a.status === "DEGRADED").length,
                failedAssets: assets.filter((a) => a.status === "FAILED").length,
                activeAlerts: alerts.length,
                lastSync: station.lastSyncAt,
              }
            : null,
          provenance: {
            source: "DATABASE",
            dataType: "MEASURED",
            timestamp: now,
          },
          error: station ? undefined : `Station ${stationId} not found`,
        };
      }

      return {
        toolName,
        success: true,
        data: {
          stationId: twinState.stationId,
          name: twinState.stationName,
          status: twinState.stationStatus,
          statusReason: twinState.statusAssessment.reason,
          totalAssets: twinState.assets.length,
          operationalAssets: twinState.assets.filter((a) => a.status === "OPERATIONAL").length,
          degradedAssets: twinState.assets.filter((a) => a.status === "DEGRADED").length,
          failedAssets: twinState.assets.filter((a) => a.status === "FAILED").length,
          activeAlerts: twinState.activeAlerts.length,
          criticalAlerts: twinState.activeAlerts.filter((a) => a.severity === "CRITICAL").length,
          operationalRisk: twinState.operationalRisk,
          energy: {
            generationKw: twinState.energy.totalGenerationKw,
            loadKw: twinState.energy.totalLoadKw,
            gridStatus: twinState.energy.gridStatus,
            batterySocPct: twinState.energy.batterySocPct,
          },
          connectivityState: twinState.connectivityState,
          lastSync: twinState.lastSynchronization,
        },
        provenance: {
          source: "DIGITAL_TWIN",
          dataType: "MEASURED",
          timestamp: now,
        },
      };
    }

    // ── Asset Status ─────────────────────────────────────────────
    case "get_asset_status": {
      const stationId = resolveStation(args);
      const assetId = args.assetId as string;
      const registry = getTwinRegistry();
      await registry.init();
      const twinState = registry.getTwinState(stationId);
      const asset = twinState?.assets.find((a) => a.assetId === assetId);

      if (!asset) {
        return {
          toolName,
          success: false,
          data: null,
          provenance: { source: "DIGITAL_TWIN", dataType: "MEASURED", timestamp: now },
          error: `Asset ${assetId} not found in station ${stationId}`,
        };
      }

      return {
        toolName,
        success: true,
        data: {
          assetId: asset.assetId,
          name: asset.name,
          type: asset.type,
          status: asset.status,
          healthScore: asset.healthScore,
          criticality: asset.criticality,
          hasActiveAnomaly: asset.anomalyState.hasActiveAnomaly,
          anomalyDetails: asset.anomalyState.details || "None",
          inMaintenance: asset.maintenanceState.inMaintenance,
          dataQuality: asset.dataQuality,
          telemetry: Object.fromEntries(
            Object.entries(asset.currentTelemetry).map(([k, v]) => [
              k,
              { value: v.value, unit: v.unit, quality: v.quality, freshness: v.freshness },
            ])
          ),
          lastUpdate: asset.lastUpdate,
        },
        provenance: { source: "DIGITAL_TWIN", dataType: "MEASURED", timestamp: now },
      };
    }

    // ── Asset Telemetry History ───────────────────────────────────
    case "get_asset_history": {
      const stationId = resolveStation(args);
      const assetId = args.assetId as string;
      const metric = (args.metric as string) || "power_output_kw";
      const limit = parseInt((args.limit as string) || "24", 10);

      if (!assetId) {
        return {
          toolName,
          success: false,
          data: null,
          provenance: { source: "DATABASE", dataType: "HISTORICAL", timestamp: now },
          error: "assetId is required for get_asset_history to prevent ambiguous cross-asset leakage",
        };
      }

      // Use the telemetry repository / pool
      const { getPool } = await import("../db/pool");
      const pool = getPool();
      const query = `SELECT value, unit, timestamp, source, quality FROM telemetry_points
         WHERE station_id = $1 AND asset_id = $2 AND metric = $3
         ORDER BY timestamp DESC LIMIT $4`;
      const result = await pool.query(query, [stationId, assetId, metric, limit]);

      return {
        toolName,
        success: true,
        data: {
          stationId,
          assetId,
          metric,
          pointCount: result.rows.length,
          points: result.rows.map((r: { value: string | number; unit: string; timestamp: string | Date; quality: string; source: string }) => ({
            value: parseFloat(String(r.value)),
            unit: r.unit,
            timestamp: r.timestamp,
            quality: r.quality,
            source: r.source === "SIMULATOR" ? "SIMULATED" : r.source,
          })),
        },
        provenance: {
          source: "DATABASE",
          dataType: "HISTORICAL",
          timestamp: now,
          disclaimer: "Historical telemetry readings from the database",
        },
      };
    }

    // ── Alerts ───────────────────────────────────────────────────
    case "get_alerts": {
      const stationId = resolveStation(args);
      const registry = getTwinRegistry();
      await registry.init();
      const twinState = registry.getTwinState(stationId);
      let alerts = twinState?.activeAlerts || [];

      if (args.severity) {
        alerts = alerts.filter((a) => a.severity === args.severity);
      }

      return {
        toolName,
        success: true,
        data: {
          stationId,
          totalActive: alerts.length,
          alerts: alerts.map((a) => ({
            id: a.id,
            severity: a.severity,
            category: a.category,
            title: a.title,
            description: a.description,
            recommendedAction: a.recommendedAction || "Monitor closely",
            createdAt: a.createdAt,
          })),
        },
        provenance: { source: "DIGITAL_TWIN", dataType: "MEASURED", timestamp: now },
      };
    }

    // ── Energy State ─────────────────────────────────────────────
    case "get_energy_state": {
      const stationId = resolveStation(args);
      const registry = getTwinRegistry();
      await registry.init();
      const twinState = registry.getTwinState(stationId);

      if (!twinState) {
        return {
          toolName,
          success: false,
          data: null,
          provenance: { source: "DIGITAL_TWIN", dataType: "MEASURED", timestamp: now },
          error: `Station ${stationId} not found`,
        };
      }

      return {
        toolName,
        success: true,
        data: {
          stationId,
          ...twinState.energy,
          operationalRisk: twinState.operationalRisk,
        },
        provenance: { source: "DIGITAL_TWIN", dataType: "MEASURED", timestamp: now },
      };
    }

    // ── Energy Forecast ──────────────────────────────────────────
    case "get_energy_forecast": {
      const stationId = resolveStation(args);
      const intelligence = await intelligenceService.getStationIntelligence(stationId);

      // Summarize for the LLM (avoid flooding with 24 points)
      const forecast = intelligence.energyForecast;
      const summary = {
        stationId,
        horizonHours: forecast.horizonHours,
        confidence: forecast.confidence,
        assumptions: forecast.assumptions,
        modelVersion: forecast.modelVersion,
        peakDemandKw: Math.max(...forecast.points.map((p) => p.predictedDemandKw)),
        minReserveKw: Math.min(...forecast.points.map((p) => p.netReserveKw)),
        avgFuelConsumptionLph: (
          forecast.points.reduce((s, p) => s + p.fuelConsumptionRateLph, 0) /
          forecast.points.length
        ).toFixed(1),
        next6hPoints: forecast.points.slice(0, 6).map((p) => ({
          hour: p.hourOffset,
          demandKw: p.predictedDemandKw,
          generationKw: p.predictedGenerationKw,
          reserveKw: p.netReserveKw,
        })),
      };

      return {
        toolName,
        success: true,
        data: summary,
        provenance: {
          source: "INTELLIGENCE_ENGINE",
          dataType: "COMPUTED",
          timestamp: now,
          disclaimer:
            "Forecast values are model predictions, not measurements. Actual values may differ.",
        },
      };
    }

    // ── Inventory Status ─────────────────────────────────────────
    case "get_inventory_status": {
      const stationId = resolveStation(args);
      const intelligence = await intelligenceService.getStationIntelligence(stationId);

      return {
        toolName,
        success: true,
        data: {
          stationId,
          items: intelligence.inventoryForecasts.map((f) => ({
            name: f.itemName,
            category: f.category,
            currentQuantity: f.currentQuantity,
            unit: f.unit,
            dailyBurnRate: f.dailyBurnRate,
            daysRemaining: f.daysRemaining,
            depletionDate: f.depletionDate,
            consumptionTrend: f.consumptionTrend,
            resupplyUrgency: f.resupplyUrgency,
          })),
        },
        provenance: {
          source: "INTELLIGENCE_ENGINE",
          dataType: "COMPUTED",
          timestamp: now,
          disclaimer: "Depletion dates are forecasts based on current consumption rates.",
        },
      };
    }

    // ── Environment Summary ──────────────────────────────────────
    case "get_environment_summary": {
      const stationId = resolveStation(args);
      const registry = getTwinRegistry();
      await registry.init();
      const twinState = registry.getTwinState(stationId);

      if (!twinState) {
        return {
          toolName,
          success: false,
          data: null,
          provenance: { source: "DIGITAL_TWIN", dataType: "MEASURED", timestamp: now },
          error: `Station ${stationId} not found`,
        };
      }

      return {
        toolName,
        success: true,
        data: {
          stationId,
          ...twinState.environment,
        },
        provenance: {
          source: "DIGITAL_TWIN",
          dataType: "MEASURED",
          timestamp: now,
          disclaimer: "Environmental readings are from the simulated Digital Twin sensors.",
        },
      };
    }

    // ── Dependency Impact ────────────────────────────────────────
    case "get_dependency_impact": {
      const stationId = resolveStation(args);
      const assetId = args.assetId as string;
      const registry = getTwinRegistry();
      await registry.init();
      const twinState = registry.getTwinState(stationId);
      const assetBelongs = twinState?.assets.some((a) => a.assetId === assetId);

      if (!assetBelongs) {
        return {
          toolName,
          success: false,
          data: null,
          provenance: { source: "DIGITAL_TWIN", dataType: "COMPUTED", timestamp: now },
          error: `Asset '${assetId}' does not belong to station '${stationId}'. Cross-station dependency leakage prohibited.`,
        };
      }

      const impact = registry.getDependencyGraph().getDownstreamImpact(assetId);

      return {
        toolName,
        success: true,
        data: {
          stationId,
          ...impact,
        },
        provenance: {
          source: "DIGITAL_TWIN",
          dataType: "COMPUTED",
          timestamp: now,
          disclaimer: "Impact analysis is based on the dependency graph model.",
        },
      };
    }

    // ── Simulation Result (Strictly Read-Only) ────────────────────
    case "get_latest_simulation":
    case "get_simulation_result": {
      const stationId = resolveStation(args);
      const history = simulationStore.listByStation(stationId, 1);
      if (history.length === 0) {
        return {
          toolName,
          success: true,
          data: { message: "No simulations have been run yet for this station." },
          provenance: { source: "SIMULATION_ENGINE", dataType: "SIMULATED", timestamp: now },
        };
      }

      const latest = history[0];
      return {
        toolName,
        success: true,
        data: {
          simulationId: latest.simulationId,
          scenarioType: latest.scenarioType,
          title: latest.title,
          label: "SIMULATION",
          explanation: latest.explanation,
          riskScore: latest.operationalRisk?.score,
          riskLevel: latest.operationalRisk?.level,
          comparisons: latest.comparisons?.slice(0, 5),
          recoveryActions: latest.recoveryState?.suggestedActions,
          createdAt: latest.createdAt,
        },
        provenance: {
          source: "SIMULATION_ENGINE",
          dataType: "SIMULATED",
          timestamp: now,
          disclaimer: "⚠️ SIMULATION: Read-only inspection of previous what-if analysis. New mutations require explicit operator confirmation outside copilot.",
        },
      };
    }

    // ── Recent Operator Actions (Station-Scoped) ─────────────────
    case "get_recent_operator_actions": {
      const stationId = resolveStation(args);
      const limit = parseInt((args.limit as string) || "10", 10);
      const repos = getRepos();
      const allEvents = await repos.auditRepo.findAll(limit * 3);
      // Filter strictly by stationId
      const events = allEvents
        .filter((e) => {
          const target = String(e.targetId || "");
          const prev = JSON.stringify(e.previousState || {});
          const next = JSON.stringify(e.newState || {});
          return target.includes(stationId) || prev.includes(stationId) || next.includes(stationId);
        })
        .slice(0, limit);

      return {
        toolName,
        success: true,
        data: {
          stationId,
          totalReturned: events.length,
          actions: events.map((e) => ({
            action: e.action,
            targetType: e.targetType,
            targetId: e.targetId,
            result: e.result,
            timestamp: e.createdAt,
            operatorId: e.operatorId || "system",
          })),
        },
        provenance: {
          source: "DATABASE",
          dataType: "HISTORICAL",
          timestamp: now,
          disclaimer: "Station-scoped audit log entries",
        },
      };
    }

    default:
      return {
        toolName,
        success: false,
        data: null,
        provenance: { source: "DIGITAL_TWIN", dataType: "COMPUTED", timestamp: now },
        error: `Unknown tool: ${toolName}`,
      };
  }
}
