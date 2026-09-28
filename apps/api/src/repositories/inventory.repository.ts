import { getPool } from "../db/pool";
import type { InventoryItem, InventoryCategory } from "@maitri-bharati/shared";

interface InventoryRow {
  id: string;
  station_id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  minimum_threshold: number;
  average_daily_consumption: number;
  lead_time_days: number;
  updated_at: Date;
}

function mapRowToInventory(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    stationId: row.station_id,
    category: row.category as InventoryCategory,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    minimumThreshold: Number(row.minimum_threshold),
    averageDailyConsumption: Number(row.average_daily_consumption),
    leadTimeDays: row.lead_time_days,
    updatedAt: new Date(row.updated_at),
  };
}

export class InventoryRepository {
  async findByStationId(stationId: string): Promise<InventoryItem[]> {
    const pool = getPool();
    const res = await pool.query<InventoryRow>(
      `SELECT id, station_id, category, name, quantity, unit, minimum_threshold, average_daily_consumption, lead_time_days, updated_at
       FROM inventory_items
       WHERE station_id = $1
       ORDER BY category ASC, name ASC;`,
      [stationId]
    );
    return res.rows.map(mapRowToInventory);
  }

  async findByCategory(stationId: string, category: InventoryCategory): Promise<InventoryItem[]> {
    const pool = getPool();
    const res = await pool.query<InventoryRow>(
      `SELECT id, station_id, category, name, quantity, unit, minimum_threshold, average_daily_consumption, lead_time_days, updated_at
       FROM inventory_items
       WHERE station_id = $1 AND category = $2
       ORDER BY name ASC;`,
      [stationId, category]
    );
    return res.rows.map(mapRowToInventory);
  }

  async updateQuantity(id: string, quantity: number): Promise<InventoryItem | null> {
    const pool = getPool();
    const res = await pool.query<InventoryRow>(
      `UPDATE inventory_items
       SET quantity = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, station_id, category, name, quantity, unit, minimum_threshold, average_daily_consumption, lead_time_days, updated_at;`,
      [quantity, id]
    );
    return res.rows.length > 0 ? mapRowToInventory(res.rows[0]) : null;
  }
}
