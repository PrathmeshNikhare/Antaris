import { getPool } from "../db/pool";
import type { Operator, OperatorRole } from "@maitri-bharati/shared";

interface OperatorRow {
  id: string;
  username: string;
  full_name: string;
  role: string;
  station_id: string | null;
  password_hash?: string | null;
  email?: string | null;
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

export interface OperatorWithAuth extends Operator {
  passwordHash?: string;
  email?: string;
}

export class OperatorRepository {
  async findAll(): Promise<Operator[]> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `SELECT id, username, full_name, role, station_id, email, created_at
       FROM operators
       ORDER BY username ASC;`
    );
    return res.rows.map(mapRowToOperator);
  }

  async findByUsername(username: string): Promise<Operator | null> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `SELECT id, username, full_name, role, station_id, email, created_at
       FROM operators
       WHERE username = $1;`,
      [username]
    );
    if (res.rows.length === 0) return null;
    return mapRowToOperator(res.rows[0]);
  }

  async findByUsernameWithAuth(username: string): Promise<OperatorWithAuth | null> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `SELECT id, username, full_name, role, station_id, password_hash, email, created_at
       FROM operators
       WHERE username = $1;`,
      [username]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...mapRowToOperator(row),
      passwordHash: row.password_hash ?? undefined,
      email: row.email ?? undefined,
    };
  }

  async findById(id: string): Promise<Operator | null> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `SELECT id, username, full_name, role, station_id, email, created_at
       FROM operators
       WHERE id = $1;`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return mapRowToOperator(res.rows[0]);
  }

  async insert(operator: Operator, passwordHash?: string, email?: string): Promise<Operator> {
    const pool = getPool();
    const res = await pool.query<OperatorRow>(
      `INSERT INTO operators (id, username, full_name, role, station_id, password_hash, email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (username) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           station_id = EXCLUDED.station_id,
           password_hash = COALESCE(EXCLUDED.password_hash, operators.password_hash),
           email = EXCLUDED.email
       RETURNING id, username, full_name, role, station_id, email, created_at;`,
      [
        operator.id,
        operator.username,
        operator.fullName,
        operator.role,
        operator.stationId ?? null,
        passwordHash ?? null,
        email ?? null,
        operator.createdAt,
      ]
    );
    return mapRowToOperator(res.rows[0]);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE operators SET password_hash = $1 WHERE id = $2;`,
      [passwordHash, id]
    );
  }
}
