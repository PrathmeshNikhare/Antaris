import { getPool } from "../db/pool";
import type { Operator, OperatorRole } from "@maitri-bharati/shared";

interface OperatorRow {
  id: string;
  username: string;
  full_name: string;
  role: string;
  station_id: string | null;
  created_at: Date;
}

function mapRowToOperator(row: OperatorRow): Operator {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role as OperatorRole,
    stationId: row.station_id ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

export class OperatorRepository {
  async findAll(): Promise<Operator[]> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `SELECT id, username, full_name, role, station_id, created_at
       FROM operators
       ORDER BY username ASC;`
    );
    return res.rows.map(mapRowToOperator);
  }

  async findByUsername(username: string): Promise<Operator | null> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `SELECT id, username, full_name, role, station_id, created_at
       FROM operators
       WHERE username = $1;`,
      [username]
    );
    if (res.rows.length === 0) return null;
    return mapRowToOperator(res.rows[0]);
  }

  async insert(operator: Operator): Promise<Operator> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `INSERT INTO operators (id, username, full_name, role, station_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO UPDATE
       SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, station_id = EXCLUDED.station_id
       RETURNING id, username, full_name, role, station_id, created_at;`,
      [
        operator.id,
        operator.username,
        operator.fullName,
        operator.role,
        operator.stationId ?? null,
        operator.createdAt,
      ]
    );
    return mapRowToOperator(res.rows[0]);
  }
}
