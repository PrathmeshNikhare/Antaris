/**
 * Explainable Isolation Forest (iForest) for Operational Intelligence.
 *
 * Implements an ensemble of isolation trees (iTrees) evaluating multivariate telemetry features:
 * - Feature 0: Current value deviation ratio
 * - Feature 1: Absolute Z-Score
 * - Feature 2: Rate of change (normalized)
 * - Feature 3: Variance ratio
 */

interface IsolationTreeNode {
  isLeaf: boolean;
  size?: number;
  splitFeature?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
}

export interface IForestScoringResult {
  score: number; // 0.0 to 1.0
  averagePathLength: number;
  isAnomaly: boolean;
  topContributingFeature: string;
  featureScores: Record<string, number>;
  modelVersion: string;
}

const FEATURE_NAMES = [
  "normalized_deviation",
  "z_score",
  "rate_of_change",
  "relative_variance",
];

export class IsolationForest {
  private trees: IsolationTreeNode[] = [];
  private readonly numTrees: number;
  private readonly sampleSize: number;
  private readonly modelVersion = "iforest-v1";

  constructor(numTrees: number = 25, sampleSize: number = 64) {
    this.numTrees = numTrees;
    this.sampleSize = sampleSize;
    this.buildPrecalibratedEnsemble();
  }

  /**
   * Average path length normalization constant c(n) for sample size n.
   * c(n) = 2 * (ln(n - 1) + EulerMascheroni) - (2 * (n - 1) / n)
   */
  private c(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    const euler = 0.5772156649;
    return 2 * (Math.log(n - 1) + euler) - (2 * (n - 1)) / n;
  }

  /**
   * Builds a calibrated forest representation based on baseline polar equipment boundaries.
   * Features:
   * 0: deviation ratio [-3.0 to +3.0]
   * 1: zScore [0.0 to 5.0]
   * 2: rate of change [-2.0 to +2.0]
   * 3: variance ratio [0.2 to 3.0]
   */
  private buildPrecalibratedEnsemble(): void {
    // Generate synthetic baseline training points matching normal operating equipment (Mulberry32-style PRNG)
    const baselineData: number[][] = [];
    let seed = 42;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // 256 normal observations: small deviation, low z-score, low rate of change
    for (let i = 0; i < 256; i++) {
      const u1 = random();
      const u2 = random();
      const g1 = Math.sqrt(-2.0 * Math.log(u1 || 0.001)) * Math.cos(2.0 * Math.PI * u2);
      const g2 = Math.sqrt(-2.0 * Math.log(u1 || 0.001)) * Math.sin(2.0 * Math.PI * u2);

      const f0 = g1 * 0.4; // normal deviation around 0
      const f1 = Math.abs(g1); // normal z-score ~0-2
      const f2 = g2 * 0.25; // rate of change small
      const f3 = 1.0 + g2 * 0.15; // variance ratio ~1.0
      baselineData.push([f0, f1, f2, f3]);
    }

    // Build the ensemble of iTrees
    const maxDepth = Math.ceil(Math.log2(this.sampleSize));
    this.trees = [];

    for (let t = 0; t < this.numTrees; t++) {
      // Subsample with replacement
      const sample: number[][] = [];
      for (let s = 0; s < this.sampleSize; s++) {
        const idx = Math.floor(random() * baselineData.length);
        sample.push(baselineData[idx]);
      }
      this.trees.push(this.buildTree(sample, 0, maxDepth, random));
    }
  }

  private buildTree(
    data: number[][],
    currentDepth: number,
    maxDepth: number,
    prng: () => number
  ): IsolationTreeNode {
    if (currentDepth >= maxDepth || data.length <= 1) {
      return { isLeaf: true, size: data.length };
    }

    // Select random split feature [0..3]
    const splitFeature = Math.floor(prng() * 4);
    const featureValues = data.map((d) => d[splitFeature]);
    const minVal = Math.min(...featureValues);
    const maxVal = Math.max(...featureValues);

    if (minVal >= maxVal) {
      return { isLeaf: true, size: data.length };
    }

    const splitValue = minVal + prng() * (maxVal - minVal);
    const leftData = data.filter((d) => d[splitFeature] < splitValue);
    const rightData = data.filter((d) => d[splitFeature] >= splitValue);

    return {
      isLeaf: false,
      splitFeature,
      splitValue,
      left: this.buildTree(leftData, currentDepth + 1, maxDepth, prng),
      right: this.buildTree(rightData, currentDepth + 1, maxDepth, prng),
    };
  }

  private computePathLength(point: number[], node: IsolationTreeNode, currentDepth: number, depthContributions: number[]): number {
    if (node.isLeaf) {
      return currentDepth + (node.size && node.size > 1 ? this.c(node.size) : 0);
    }

    if (node.splitFeature !== undefined && node.splitValue !== undefined) {
      depthContributions[node.splitFeature] += 1;
      if (point[node.splitFeature] < node.splitValue) {
        return this.computePathLength(point, node.left!, currentDepth + 1, depthContributions);
      } else {
        return this.computePathLength(point, node.right!, currentDepth + 1, depthContributions);
      }
    }

    return currentDepth;
  }

  /**
   * Scores a vector of [normalizedDeviation, zScore, rateOfChange, relativeVariance]
   */
  public scorePoint(features: number[]): IForestScoringResult {
    let totalPathLength = 0;
    const splitCounts = [0, 0, 0, 0];

    for (const tree of this.trees) {
      const treeContributions = [0, 0, 0, 0];
      const pathLength = this.computePathLength(features, tree, 0, treeContributions);
      totalPathLength += pathLength;
      for (let i = 0; i < 4; i++) {
        splitCounts[i] += treeContributions[i];
      }
    }

    const avgPathLength = totalPathLength / this.trees.length;
    const cN = this.c(this.sampleSize);
    // Anomaly score formula: s = 2 ^ (- avgPathLength / cN)
    const anomalyScore = Math.pow(2, -avgPathLength / cN);

    // Feature importance attribution: features with the highest split participations for shallow isolates
    const totalSplits = splitCounts.reduce((a, b) => a + b, 0) || 1;
    const featureScores: Record<string, number> = {};
    let topFeature = FEATURE_NAMES[1]; // default zScore
    let maxShare = -1;

    for (let i = 0; i < 4; i++) {
      const share = splitCounts[i] / totalSplits;
      featureScores[FEATURE_NAMES[i]] = Number(share.toFixed(3));
      if (share > maxShare) {
        maxShare = share;
        topFeature = FEATURE_NAMES[i];
      }
    }

    return {
      score: Number(anomalyScore.toFixed(3)),
      averagePathLength: Number(avgPathLength.toFixed(2)),
      isAnomaly: anomalyScore >= 0.62,
      topContributingFeature: topFeature,
      featureScores,
      modelVersion: this.modelVersion,
    };
  }
}
