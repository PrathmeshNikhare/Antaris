import type { ModelObservabilityRecord } from "@maitri-bharati/shared";

export class ModelRegistry {
  private records: ModelObservabilityRecord[] = [];
  private readonly maxRecords = 200;

  /**
   * Logs a model execution event into the observability store.
   */
  public logExecution(record: Omit<ModelObservabilityRecord, "id">): ModelObservabilityRecord {
    const fullRecord: ModelObservabilityRecord = {
      id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...record,
    };

    this.records.unshift(fullRecord);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }

    return fullRecord;
  }

  /**
   * Retrieves recent model observability records, optionally filtered by task or model.
   */
  public listRecords(filters?: {
    task?: ModelObservabilityRecord["task"];
    modelName?: string;
    limit?: number;
  }): ModelObservabilityRecord[] {
    let result = this.records;
    if (filters?.task) {
      result = result.filter((r) => r.task === filters.task);
    }
    if (filters?.modelName) {
      result = result.filter((r) => r.modelName === filters.modelName);
    }
    const limit = filters?.limit ?? 50;
    return result.slice(0, limit);
  }

  public clear(): void {
    this.records = [];
  }
}

export const modelRegistry = new ModelRegistry();
