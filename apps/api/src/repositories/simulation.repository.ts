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
}
