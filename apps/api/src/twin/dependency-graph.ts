import type { AssetDependency, Criticality } from "@maitri-bharati/shared";

export interface DownstreamImpactAnalysis {
  rootAssetId: string;
  impactedAssetIds: string[];
  paths: string[][];
  maxCriticality: Criticality;
  impactedCount: number;
}

export class TwinDependencyGraph {
  private adjacencyList: Map<string, Array<{ toAssetId: string; dependencyType: string; criticality: Criticality }>> = new Map();
  private allDependencies: AssetDependency[] = [];

  constructor(dependencies: AssetDependency[] = []) {
    this.updateGraph(dependencies);
  }

  updateGraph(dependencies: AssetDependency[]): void {
    this.allDependencies = [...dependencies];
    this.adjacencyList.clear();

    for (const dep of dependencies) {
      const edges = this.adjacencyList.get(dep.fromAssetId) ?? [];
      edges.push({
        toAssetId: dep.toAssetId,
        dependencyType: dep.dependencyType,
        criticality: dep.criticality,
      });
      this.adjacencyList.set(dep.fromAssetId, edges);
    }
  }

  getDownstreamImpact(rootAssetId: string): DownstreamImpactAnalysis {
    const visited = new Set<string>();
    const impactedAssetIds: string[] = [];
    const paths: string[][] = [];
    let maxCriticality: Criticality = "LOW";

    const criticalityRanks: Record<Criticality, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const dfs = (currentAssetId: string, currentPath: string[]): void => {
      const edges = this.adjacencyList.get(currentAssetId) ?? [];

      for (const edge of edges) {
        const nextId = edge.toAssetId;

        // Upgrade criticality if higher
        if (criticalityRanks[edge.criticality] > criticalityRanks[maxCriticality]) {
          maxCriticality = edge.criticality;
        }

        const newPath = [...currentPath, nextId];
        paths.push(newPath);

        if (!visited.has(nextId)) {
          visited.add(nextId);
          impactedAssetIds.push(nextId);
          dfs(nextId, newPath);
        }
      }
    };

    dfs(rootAssetId, [rootAssetId]);

    return {
      rootAssetId,
      impactedAssetIds,
      paths,
      maxCriticality,
      impactedCount: impactedAssetIds.length,
    };
  }

  getDependencies(): AssetDependency[] {
    return [...this.allDependencies];
  }
}
