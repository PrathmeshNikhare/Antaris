import { getPool } from "../db/pool";
import type { SimulationRun } from "@maitri-bharati/shared";

interface SimulationRow {
  id: string;
  station_id: string;
  scenario_type: string;
  input_state: Record<string, unknown>;
  output_state: Record<string, unknown>;
  impacts: Record<string, unknown>;
  created_at: Date;
}

function mapRowToSimulation(row: SimulationRow): SimulationRun {
  return {
    id: row.id,
    stationId: row.station_id,
    scenarioType: row.scenario_type,
    inputState: typeof row.input_state === "string" ? JSON.parse(row.input_state) : row.input_state,
    outputState: typeof row.output_state === "string" ? JSON.parse(row.output_state) : row.output_state,
    impacts: typeof row.impacts === "string" ? JSON.parse(row.impacts) : row.impacts,
    createdAt: new Date(row.created_at),
  };
}

export class SimulationRepository {
  async findByStationId(stationId: string): Promise<SimulationRun[]> {
    const pool = getPool();
    const res = await pool.query<SimulationRow>(
      `SELECT id, station_id, scenario_type, input_state, output_state, impacts, created_at
       FROM simulation_runs
       WHERE station_id = $1
       ORDER BY created_at DESC
       LIMIT 50;`,
      [stationId]
    );
    return res.rows.map(mapRowToSimulation);
  }

  async findById(id: string): Promise<SimulationRun | null> {
    const pool = getPool();
    const res = await pool.query<SimulationRow>(
      `SELECT id, station_id, scenario_type, input_state, output_state, impacts, created_at
       FROM simulation_runs
       WHERE id = $1;`,
      [id]
    );
    return res.rows.length > 0 ? mapRowToSimulation(res.rows[0]) : null;
  }

  async create(run: SimulationRun): Promise<SimulationRun> {
    const pool = getPool();
    const res = await pool.query<SimulationRow>(
      `INSERT INTO simulation_runs (id, station_id, scenario_type, input_state, output_state, impacts, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, station_id, scenario_type, input_state, output_state, impacts, created_at;`,
      [
        run.id,
        run.stationId,
        run.scenarioType,
        JSON.stringify(run.inputState),
        JSON.stringify(run.outputState),
        JSON.stringify(run.impacts),
        run.createdAt,
      ]
    );
    return mapRowToSimulation(res.rows[0]);
  }

  async saveResilienceResult(result: any): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO simulation_runs (
          id, station_id, scenario_type, title, label, model_version,
          deterministic_seed, parameters, input_state, output_state,
          impacts, comparisons, blast_radius, operational_risk,
          recovery_state, explanation, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          output_state = EXCLUDED.output_state,
          impacts = EXCLUDED.impacts,
          comparisons = EXCLUDED.comparisons,
          blast_radius = EXCLUDED.blast_radius,
          operational_risk = EXCLUDED.operational_risk,
          recovery_state = EXCLUDED.recovery_state,
          explanation = EXCLUDED.explanation;`,
        [
          result.simulationId,
          result.stationId,
          result.scenarioType,
          result.title || result.scenarioType,
          result.label || "SIMULATION",
          result.modelVersion || "2.1.0-polar",
          result.deterministicSeed || "42",
          JSON.stringify(result.parameters || {}),
          JSON.stringify(result.baselineSnapshot || {}),
          JSON.stringify(result.scenarioState || {}),
          JSON.stringify(result.impactedAssets || []),
          JSON.stringify(result.comparisons || []),
          JSON.stringify(result.blastRadius || { nodes: [], links: [] }),
          JSON.stringify(result.operationalRisk || { score: 0, level: "LOW", factors: [] }),
          JSON.stringify(result.recoveryState || { suggestedActions: [], estimatedRecoveryMinutes: 0 }),
          result.explanation || "",
          new Date(result.createdAt || Date.now()),
        ]
      );
    } catch (err) {
      console.warn("[SimulationRepository] Failed to persist simulation run to DB:", err);
    }
  }

  async findResilienceById(id: string): Promise<any | null> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT * FROM simulation_runs WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToResilience(res.rows[0]);
  }

  async findResilienceByStation(stationId: string, limit = 20): Promise<any[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT * FROM simulation_runs WHERE station_id = $1 ORDER BY created_at DESC LIMIT $2;`,
      [stationId, limit]
    );
    return res.rows.map((row) => this.mapRowToResilience(row));
  }

  async findAllResilience(limit = 50): Promise<any[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT $1;`,
      [limit]
    );
    return res.rows.map((row) => this.mapRowToResilience(row));
  }

  private mapRowToResilience(row: any): any {
    const parse = (val: any, def: any) => {
      if (!val) return def;
      return typeof val === "string" ? JSON.parse(val) : val;
    };
    return {
      simulationId: row.id,
      stationId: row.station_id,
      scenarioType: row.scenario_type,
      title: row.title || row.scenario_type,
      label: row.label || "SIMULATION",
      modelVersion: row.model_version || "2.1.0-polar",
      deterministicSeed: row.deterministic_seed || "42",
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      snapshotTimestamp: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      parameters: parse(row.parameters, {}),
      baselineSnapshot: parse(row.input_state, {}),
      scenarioState: parse(row.output_state, {}),
      explanation: row.explanation || "",
      impactedAssets: parse(row.impacts, []),
      blastRadius: parse(row.blast_radius, { nodes: [], links: [] }),
      comparisons: parse(row.comparisons, []),
      operationalRisk: parse(row.operational_risk, { score: 0, level: "LOW", factors: [] }),
      recoveryState: parse(row.recovery_state, { suggestedActions: [], estimatedRecoveryMinutes: 0 }),
    };
  }
}
