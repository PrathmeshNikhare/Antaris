import type { ResilienceSimulationResult } from "@maitri-bharati/shared";

export class SimulationStore {
  private history: ResilienceSimulationResult[] = [];
  private readonly maxItems = 100;

  public save(result: ResilienceSimulationResult): void {
    // Prepend so latest appears first
    this.history.unshift(result);
    if (this.history.length > this.maxItems) {
      this.history.pop();
    }
  }

  public getById(id: string): ResilienceSimulationResult | undefined {
    return this.history.find((sim) => sim.simulationId === id);
  }

  public listByStation(stationId: string, limit = 20): ResilienceSimulationResult[] {
    return this.history
      .filter((sim) => sim.stationId === stationId)
      .slice(0, limit);
  }

  public getAll(limit = 50): ResilienceSimulationResult[] {
    return this.history.slice(0, limit);
  }

  public clear(): void {
    this.history = [];
  }
}

export const simulationStore = new SimulationStore();
