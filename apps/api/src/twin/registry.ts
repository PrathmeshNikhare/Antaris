import { computeFreshness } from "./freshness";
import { AssetHealthEvaluator } from "./health";
import { TwinDependencyGraph } from "./dependency-graph";
import { StationAggregateEvaluator } from "./evaluator";
import { twinWebSocketManager } from "./websocket";
import {
  StationRepository,
  AssetRepository,
  AssetDependencyRepository,
  MetricDefinitionRepository,
  AlertRepository,
  TelemetryRepository,
} from "../repositories";
import { maitriBharatiSeedData } from "../db/seeds/maitri_bharati_seeds";
import { hardeningSeedData } from "../db/seeds/hardening_seeds";
import type {
  TwinState,
  TwinAssetState,
  TwinSnapshot,
  TelemetryPoint,
  StateTransitionEvent,
  ConnectivityState,
} from "@maitri-bharati/shared";

export class TwinStateRegistry {
  private states: Map<string, TwinState> = new Map();
  private healthEvaluator: AssetHealthEvaluator;
  private dependencyGraph: TwinDependencyGraph;
  private aggregateEvaluator: StationAggregateEvaluator;
  private initialized = false;

  constructor() {
    this.healthEvaluator = new AssetHealthEvaluator();
    this.dependencyGraph = new TwinDependencyGraph();
    this.aggregateEvaluator = new StationAggregateEvaluator();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const stationRepo = new StationRepository();
      const assetRepo = new AssetRepository();
      const depRepo = new AssetDependencyRepository();
      const metricRepo = new MetricDefinitionRepository();
      const alertRepo = new AlertRepository();

      const [stations, allAssets, deps, metricDefs] = await Promise.all([
        stationRepo.findAll(),
        assetRepo.findAll(),
        depRepo.findAll(),
        metricRepo.findAll(),
      ]);

      this.healthEvaluator.updateDefinitions(metricDefs);
      this.dependencyGraph.updateGraph(deps);

      for (const st of stations) {
        const stationAssets = allAssets.filter((a) => a.stationId === st.id);
        const alerts = await alertRepo.findByStationId(st.id);

        const twinAssets: TwinAssetState[] = stationAssets.map((a) => ({
          assetId: a.id,
          stationId: st.id,
          name: a.name,
          type: a.type,
          criticality: a.criticality,
          currentTelemetry: {},
          status: a.status,
          healthScore: a.healthScore ?? 90,
          lastUpdate: new Date().toISOString(),
          freshness: computeFreshness(new Date()),
          dataQuality: "GOOD",
          anomalyState: { hasActiveAnomaly: false },
          maintenanceState: { inMaintenance: a.status === "MAINTENANCE" },
          impactedDownstreamAssets: [],
        }));

        const nowIso = new Date().toISOString();
        const energy = this.aggregateEvaluator.evaluateEnergyState(twinAssets, nowIso);
        const env = this.aggregateEvaluator.evaluateEnvironmentState(twinAssets, nowIso);
        const logistics = this.aggregateEvaluator.evaluateLogisticsState(twinAssets, nowIso);
        const statusAssessment = this.aggregateEvaluator.evaluateStationStatus(
          twinAssets,
          alerts,
          "NORMAL"
        );
        const risk = this.aggregateEvaluator.evaluateOperationalRisk(
          statusAssessment.currentState,
          env,
          energy,
          logistics
        );

        const twinState: TwinState = {
          stationId: st.id,
          stationCode: st.code,
          stationName: st.name,
          timestamp: nowIso,
          statusAssessment,
          stationStatus: statusAssessment.currentState,
          lastSynchronization: nowIso,
          dataFreshness: computeFreshness(new Date()),
          connectivityState: "NORMAL",
          dataQualitySummary: { goodCount: 0, suspectCount: 0, badCount: 0, overallQuality: "GOOD" },
          assets: twinAssets,
          energy,
          environment: env,
          logistics,
          activeAlerts: alerts,
          operationalRisk: risk,
          recentTransitions: [],
        };

        this.states.set(st.id, twinState);
      }

      this.initialized = true;
      console.log(`[twin-registry] Digital Twin initialized for ${this.states.size} stations`);
    } catch (err) {
      console.warn("[twin-registry] Database unavailable, initializing in-memory fallback from seed definitions:", err);
      this.initFromStaticSeeds();
    }
  }

  public initFromStaticSeeds(): void {
    const seedStations = maitriBharatiSeedData.stations;
    const allAssets = maitriBharatiSeedData.assets;
    const deps = hardeningSeedData.dependencies;
    const metricDefs = hardeningSeedData.metricDefinitions;

    this.healthEvaluator.updateDefinitions(metricDefs as any);
    this.dependencyGraph.updateGraph(deps as any);

    for (const st of seedStations) {
      const stationAssets = allAssets.filter((a) => a.stationId === st.id);
      const twinAssets: TwinAssetState[] = stationAssets.map((a) => ({
        assetId: a.id,
        stationId: st.id,
        name: a.name,
        type: a.type,
        criticality: a.criticality,
        currentTelemetry: {},
        status: a.status,
        healthScore: a.healthScore ?? 90,
        lastUpdate: new Date().toISOString(),
        freshness: computeFreshness(new Date()),
        dataQuality: "GOOD",
        anomalyState: { hasActiveAnomaly: false },
        maintenanceState: { inMaintenance: a.status === "MAINTENANCE" },
        impactedDownstreamAssets: [],
      }));

      const nowIso = new Date().toISOString();
      const energy = this.aggregateEvaluator.evaluateEnergyState(twinAssets, nowIso);
      const env = this.aggregateEvaluator.evaluateEnvironmentState(twinAssets, nowIso);
      const logistics = this.aggregateEvaluator.evaluateLogisticsState(twinAssets, nowIso);
      const statusAssessment = this.aggregateEvaluator.evaluateStationStatus(
        twinAssets,
        [],
        "NORMAL"
      );
      const risk = this.aggregateEvaluator.evaluateOperationalRisk(
        statusAssessment.currentState,
        env,
        energy,
        logistics
      );

      const twinState: TwinState = {
        stationId: st.id,
        stationCode: st.code,
        stationName: st.name,
        timestamp: nowIso,
        statusAssessment,
        stationStatus: statusAssessment.currentState,
        lastSynchronization: nowIso,
        dataFreshness: computeFreshness(new Date()),
        connectivityState: "NORMAL",
        dataQualitySummary: { goodCount: 10, suspectCount: 0, badCount: 0, overallQuality: "GOOD" },
        assets: twinAssets,
        energy,
        environment: env,
        logistics,
        activeAlerts: [],
        operationalRisk: risk,
        recentTransitions: [],
      };

      this.states.set(st.id, twinState);
    }

    this.initialized = true;
    console.log(`[twin-registry] Digital Twin fallback initialized for ${this.states.size} stations`);
  }

  getTwinState(stationId: string): TwinState | undefined {
    let state = this.states.get(stationId);
    if (!state && this.states.size === 0) {
      this.initFromStaticSeeds();
      state = this.states.get(stationId);
    }
    if (!state) return undefined;

    // Refresh freshness timestamps before returning
    const now = new Date();
    state.dataFreshness = computeFreshness(state.lastSynchronization, now);
    if (state.connectivityState === "OFFLINE" && state.dataFreshness.status === "FRESH") {
      state.dataFreshness.status = "STALE";
    }
    for (const asset of state.assets) {
      asset.freshness = computeFreshness(asset.lastUpdate, now);
      for (const prop of Object.values(asset.currentTelemetry)) {
        const f = computeFreshness(prop.observedAt, now);
        prop.ageSeconds = f.ageSeconds;
        prop.freshness = f.status;
      }
    }

    return state;
  }

  getAllStationIds(): string[] {
    return Array.from(this.states.keys());
  }

  handleTelemetryPoint(point: TelemetryPoint): void {
    const stationState = this.states.get(point.stationId);
    if (!stationState) return;

    const now = new Date();
    const nowIso = now.toISOString();
    stationState.lastSynchronization = nowIso;
    stationState.timestamp = nowIso;

    // 1. Locate asset or assign to station-level virtual asset
    let targetAsset: TwinAssetState | undefined;
    if (point.assetId) {
      targetAsset = stationState.assets.find((a) => a.assetId === point.assetId);
    }

    // If no direct asset match (e.g. ambient environment sensor), assign to station environment
    if (!targetAsset && stationState.assets.length > 0) {
      targetAsset = stationState.assets.find((a) => a.type === "BUILDING") ?? stationState.assets[0];
    }

    if (targetAsset) {
      const prevAssetStatus = targetAsset.status;
      const freshness = computeFreshness(point.timestamp, now);

      // 2. Map metric to Twin property
      targetAsset.currentTelemetry[point.metric] = {
        value: point.value,
        unit: point.unit,
        timestamp: point.timestamp.toISOString(),
        quality: point.quality,
        source: point.source,
        sequence: point.sequence,
        observedAt: point.timestamp.toISOString(),
        ageSeconds: freshness.ageSeconds,
        freshness: freshness.status,
      };

      targetAsset.lastUpdate = nowIso;
      targetAsset.dataQuality = point.quality;

      // 3. Evaluate health score & asset status
      const evaluation = this.healthEvaluator.evaluateAsset(targetAsset.currentTelemetry);
      targetAsset.healthScore = evaluation.healthScore;
      targetAsset.status = evaluation.status;
      targetAsset.anomalyState = {
        hasActiveAnomaly: Boolean(evaluation.primaryConcern),
        details: evaluation.primaryConcern,
      };

      // 4. Asset state transition detection & downstream impact
      if (prevAssetStatus !== targetAsset.status) {
        const transition: StateTransitionEvent = {
          id: `trans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          entityType: "ASSET",
          entityId: targetAsset.assetId,
          previousState: prevAssetStatus,
          newState: targetAsset.status,
          reason: evaluation.primaryConcern || `Status changed to ${targetAsset.status}`,
          triggerMetric: point.metric,
          timestamp: nowIso,
        };
        stationState.recentTransitions.unshift(transition);
        if (stationState.recentTransitions.length > 50) {
          stationState.recentTransitions.pop();
        }

        // If asset degraded or failed, compute and attach downstream impact cascade
        if (targetAsset.status === "DEGRADED" || targetAsset.status === "FAILED") {
          const impact = this.dependencyGraph.getDownstreamImpact(targetAsset.assetId);
          targetAsset.impactedDownstreamAssets = impact.impactedAssetIds;

          twinWebSocketManager.broadcast(
            "dependency.impact_changed",
            point.stationId,
            impact
          );
        } else {
          targetAsset.impactedDownstreamAssets = [];
        }

        twinWebSocketManager.broadcast(
          "asset.state_changed",
          point.stationId,
          { asset: targetAsset, transition }
        );
      }
    }

    // 5. Update data quality summary
    let goodCount = 0;
    let suspectCount = 0;
    let badCount = 0;

    for (const a of stationState.assets) {
      for (const p of Object.values(a.currentTelemetry)) {
        if (p.quality === "GOOD") goodCount++;
        else if (p.quality === "SUSPECT") suspectCount++;
        else if (p.quality === "BAD") badCount++;
      }
    }

    stationState.dataQualitySummary = {
      goodCount,
      suspectCount,
      badCount,
      overallQuality: badCount > 0 ? "BAD" : suspectCount > 0 ? "SUSPECT" : "GOOD",
    };

    // 6. Recalculate station-level aggregates
    const prevStationStatus = stationState.stationStatus;
    stationState.energy = this.aggregateEvaluator.evaluateEnergyState(stationState.assets, nowIso);
    stationState.environment = this.aggregateEvaluator.evaluateEnvironmentState(stationState.assets, nowIso);
    stationState.logistics = this.aggregateEvaluator.evaluateLogisticsState(stationState.assets, nowIso);
    stationState.statusAssessment = this.aggregateEvaluator.evaluateStationStatus(
      stationState.assets,
      stationState.activeAlerts,
      stationState.connectivityState
    );
    stationState.stationStatus = stationState.statusAssessment.currentState;
    stationState.operationalRisk = this.aggregateEvaluator.evaluateOperationalRisk(
      stationState.stationStatus,
      stationState.environment,
      stationState.energy,
      stationState.logistics
    );

    // 7. Station state transition detection
    if (prevStationStatus !== stationState.stationStatus) {
      const stationTrans: StateTransitionEvent = {
        id: `trans-st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entityType: "STATION",
        entityId: stationState.stationId,
        previousState: prevStationStatus,
        newState: stationState.stationStatus,
        reason: stationState.statusAssessment.reason,
        timestamp: nowIso,
      };
      stationState.recentTransitions.unshift(stationTrans);

      twinWebSocketManager.broadcast(
        "station.state_changed",
        point.stationId,
        { assessment: stationState.statusAssessment, transition: stationTrans }
      );
    }

    // 8. Broadcast telemetry update
    twinWebSocketManager.broadcast("telemetry.updated", point.stationId, {
      point,
      assetId: targetAsset?.assetId,
    });
  }

  setConnectivityState(stationId: string, state: ConnectivityState): void {
    const stationState = this.states.get(stationId);
    if (!stationState) return;

    stationState.connectivityState = state;

    // Mutate comms asset health based on connectivity link state
    const commAssetId = stationId === "station-maitri" ? "asset-maitri-comm-1" : "asset-bharati-ground-1";
    const commAsset = stationState.assets.find((a) => a.assetId === commAssetId);
    if (commAsset) {
      if (state === "OFFLINE") {
        commAsset.status = "OFFLINE";
        commAsset.healthScore = 0;
      } else if (state === "DEGRADED") {
        commAsset.status = "DEGRADED";
        commAsset.healthScore = 55;
      } else if (state === "RECOVERY") {
        commAsset.status = "OPERATIONAL";
        commAsset.healthScore = 85;
      } else {
        commAsset.status = "OPERATIONAL";
        commAsset.healthScore = 90;
      }

      twinWebSocketManager.broadcast("asset.state_changed", stationId, commAsset);
    }

    // In blackout, mark freshness as stale immediately since transmission is severed
    if (state === "OFFLINE") {
      const syncIso =
        typeof stationState.lastSynchronization === "string"
          ? stationState.lastSynchronization
          : (stationState.lastSynchronization as Date)?.toISOString?.() ?? new Date().toISOString();
      stationState.dataFreshness = {
        observedAt: syncIso,
        ageSeconds: Math.max(35, stationState.dataFreshness.ageSeconds),
        status: "STALE",
      };
    }

    stationState.statusAssessment = this.aggregateEvaluator.evaluateStationStatus(
      stationState.assets,
      stationState.activeAlerts,
      state
    );
    stationState.stationStatus = stationState.statusAssessment.currentState;

    twinWebSocketManager.broadcast("connectivity.changed", stationId, {
      connectivityState: state,
      statusAssessment: stationState.statusAssessment,
    });
    twinWebSocketManager.broadcast("station.state_changed", stationId, {
      stationStatus: stationState.stationStatus,
      statusAssessment: stationState.statusAssessment,
    });
  }

  /**
   * Creates an immutable, serializable snapshot of the current Twin state.
   */
  createSnapshot(stationId: string): TwinSnapshot {
    const current = this.getTwinState(stationId);
    if (!current) {
      throw new Error(`Cannot create snapshot: Station ${stationId} not found`);
    }

    // Deep clone and freeze
    const cloned = JSON.parse(JSON.stringify(current));
    const snapshot: TwinSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      stationId,
      snapshotAt: new Date().toISOString(),
      state: Object.freeze(cloned),
    };

    return Object.freeze(snapshot);
  }

  /**
   * Reconstructs historical Twin state at a specific timestamp by replaying database telemetry.
   */
  async reconstructStateAt(stationId: string, timestamp: Date): Promise<TwinSnapshot> {
    const telemRepo = new TelemetryRepository();
    const historicalPoints = await telemRepo.findRecent({
      stationId,
      to: timestamp,
      limit: 1000,
    });

    // Replay chronologically
    const sorted = [...historicalPoints].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Create a temporary isolated registry instance for reconstruction
    const tempRegistry = new TwinStateRegistry();
    await tempRegistry.init();

    for (const pt of sorted) {
      tempRegistry.handleTelemetryPoint(pt);
    }

    const reconstructed = tempRegistry.createSnapshot(stationId);
    return reconstructed;
  }

  getDependencyGraph(): TwinDependencyGraph {
    return this.dependencyGraph;
  }
}

let twinRegistryInstance: TwinStateRegistry | null = null;

export function getTwinRegistry(): TwinStateRegistry {
  if (!twinRegistryInstance) {
    twinRegistryInstance = new TwinStateRegistry();
  }
  return twinRegistryInstance;
}
