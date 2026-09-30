import { getPool } from "../db/pool";
import { maitriBharatiSeedData } from "../db/seeds/maitri_bharati_seeds";
import type { Station, StationCode, StationStatus, DataMode } from "@maitri-bharati/shared";

interface StationRow {
  id: string;
  code: string;
  name: string;
  location_label: string;
  status: string;
  last_sync_at: Date;
  data_mode: string;
}

function mapRowToStation(row: StationRow): Station {
  return {
    id: row.id,
    code: row.code as StationCode,
    name: row.name,
    locationLabel: row.location_label,
    status: row.status as StationStatus,
    lastSyncAt: new Date(row.last_sync_at),
    dataMode: row.data_mode as DataMode,
  };
}

export class StationRepository {
  async findAll(): Promise<Station[]> {
    try {
      const pool = getPool();
      const res = await pool.query<StationRow>(
        "SELECT id, code, name, location_label, status, last_sync_at, data_mode FROM stations ORDER BY name ASC;"
      );
      return res.rows.map(mapRowToStation);
    } catch {
      return maitriBharatiSeedData.stations.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        locationLabel: s.locationLabel,
        status: s.status,
        lastSyncAt: new Date(),
        dataMode: s.dataMode,
      }));
    }
  }

  async findById(id: string): Promise<Station | null> {
    try {
      const pool = getPool();
      const res = await pool.query<StationRow>(
        "SELECT id, code, name, location_label, status, last_sync_at, data_mode FROM stations WHERE id = $1;",
        [id]
      );
      return res.rows.length > 0 ? mapRowToStation(res.rows[0]) : null;
    } catch {
      const s = maitriBharatiSeedData.stations.find((st) => st.id === id);
      if (!s) return null;
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        locationLabel: s.locationLabel,
        status: s.status,
        lastSyncAt: new Date(),
        dataMode: s.dataMode,
      };
    }
  }

  async findByCode(code: string): Promise<Station | null> {
    try {
      const pool = getPool();
      const res = await pool.query<StationRow>(
        "SELECT id, code, name, location_label, status, last_sync_at, data_mode FROM stations WHERE UPPER(code) = UPPER($1);",
        [code]
      );
      return res.rows.length > 0 ? mapRowToStation(res.rows[0]) : null;
    } catch {
      const s = maitriBharatiSeedData.stations.find(
        (st) => st.code.toUpperCase() === code.toUpperCase()
      );
      if (!s) return null;
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        locationLabel: s.locationLabel,
        status: s.status,
        lastSyncAt: new Date(),
        dataMode: s.dataMode,
      };
    }
  }

  async updateStatus(id: string, status: StationStatus): Promise<Station | null> {
    const pool = getPool();
    const res = await pool.query<StationRow>(
      `UPDATE stations
       SET status = $1, updated_at = NOW(), last_sync_at = NOW()
       WHERE id = $2
       RETURNING id, code, name, location_label, status, last_sync_at, data_mode;`,
      [status, id]
    );
    return res.rows.length > 0 ? mapRowToStation(res.rows[0]) : null;
  }
}
