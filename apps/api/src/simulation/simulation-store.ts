import type { ResilienceSimulationResult } from "@maitri-bharati/shared";
import { SimulationRepository } from "../repositories/simulation.repository";

export class SimulationStore {
  private history: ResilienceSimulationResult[] = [];
  private readonly maxItems = 100;
  private repo = new SimulationRepository();

  public save(result: ResilienceSimulationResult): void {
    // Prepend so latest appears first in memory cache
    const existingIdx = this.history.findIndex((s) => s.simulationId === result.simulationId);
    if (existingIdx >= 0) {
      this.history[existingIdx] = result;
    } else {
      this.history.unshift(result);
      if (this.history.length > this.maxItems) {
        this.history.pop();
      }
    }

    // Persist to PostgreSQL database asynchronously
    void this.repo.saveResilienceResult(result);
  }

  public getById(id: string): ResilienceSimulationResult | undefined {
    return this.history.find((sim) => sim.simulationId === id);
  }

  public async getByIdAsync(id: string): Promise<ResilienceSimulationResult | null> {
    const cached = this.getById(id);
    if (cached) return cached;
    try {
      const fromDb = await this.repo.findResilienceById(id);
      if (fromDb) {
        this.history.unshift(fromDb);
        return fromDb;
      }
    } catch (err) {
      console.warn(`[SimulationStore] Failed to query simulation ${id} from DB:`, err);
    }
    return null;
  }

  public listByStation(stationId: string, limit = 20): ResilienceSimulationResult[] {
    return this.history
      .filter((sim) => sim.stationId === stationId)
      .slice(0, limit);
  }

  public async listByStationAsync(stationId: string, limit = 20): Promise<ResilienceSimulationResult[]> {
    const memory = this.listByStation(stationId, limit);
    if (memory.length >= limit) return memory;

    try {
      const fromDb = await this.repo.findResilienceByStation(stationId, limit);
      // Merge unique by simulationId
      const map = new Map<string, ResilienceSimulationResult>();
      for (const item of memory) map.set(item.simulationId, item);
      for (const item of fromDb) {
        if (!map.has(item.simulationId)) {
          map.set(item.simulationId, item);
        }
      }
      return Array.from(map.values()).slice(0, limit);
    } catch {
      return memory;
    }
  }

  public getAll(limit = 50): ResilienceSimulationResult[] {
    return this.history.slice(0, limit);
  }

  public async getAllAsync(limit = 50): Promise<ResilienceSimulationResult[]> {
    const memory = this.getAll(limit);
    if (memory.length >= limit) return memory;

    try {
      const fromDb = await this.repo.findAllResilience(limit);
      const map = new Map<string, ResilienceSimulationResult>();
      for (const item of memory) map.set(item.simulationId, item);
      for (const item of fromDb) {
        if (!map.has(item.simulationId)) {
          map.set(item.simulationId, item);
        }
      }
      return Array.from(map.values()).slice(0, limit);
    } catch {
      return memory;
    }
  }

  public clear(): void {
    this.history = [];
  }
}

export const simulationStore = new SimulationStore();

