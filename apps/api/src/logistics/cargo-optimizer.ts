import type {
  CargoOptimizationResult,
  CargoOptimizedItem,
  InventoryItem,
  CargoMission,
} from "@maitri-bharati/shared";

/**
 * Deterministic Resupply / Cargo Allocation Optimizer
 * Uses a greedy urgency-weighted knapsack heuristic to prioritize
 * life-support critical items (fuel, medical, water filters, generator spares)
 * subject to transport payload constraints and polar weather windows.
 */
export function optimizeCargoAllocation(
  stationId: string,
  inventory: InventoryItem[],
  mission: CargoMission,
  weatherRiskIndex = 0.35
): CargoOptimizationResult {
  const maxPayloadKg = mission.maxPayloadKg || mission.capacityKg || 25000;
  const itemsToLoad: CargoOptimizedItem[] = [];

  // 1. Calculate depletion urgency for each inventory item
  const scoredItems = inventory.map((item) => {
    const dailyBurn = Math.max(item.averageDailyConsumption, 0.05);
    const currentRunwayDays = Number((item.quantity / dailyBurn).toFixed(1));
    const safetyMarginRatio = item.quantity / Math.max(item.minimumThreshold, 1);

    // Criticality weight
    let categoryWeight = 1.0;
    const cat = item.category as string;
    if (cat === "FUEL") categoryWeight = 3.5;
    else if (cat === "MEDICAL") categoryWeight = 3.0;
    else if (cat === "WATER") categoryWeight = 2.8;
    else if (cat === "SPARES") categoryWeight = 2.4;
    else if (cat === "FOOD") categoryWeight = 2.0;

    // Lower runway days = higher score
    const urgencyScore = (100 / Math.max(currentRunwayDays, 1)) * categoryWeight;

    // Estimated unit weight in kg
    let unitWeightKg = 1.0;
    if (item.category === "FUEL") unitWeightKg = 0.85; // kg/liter
    else if (item.unit === "Kg" || item.unit === "kg") unitWeightKg = 1.0;
    else if (item.unit === "Drums") unitWeightKg = 180.0;
    else if (item.unit === "Modules") unitWeightKg = 12.0;
    else if (item.unit === "Kits") unitWeightKg = 5.0;

    return {
      item,
      currentRunwayDays,
      safetyMarginRatio,
      urgencyScore,
      unitWeightKg,
    };
  });

  // Sort descending by urgency score (deterministic greedy approach)
  scoredItems.sort((a, b) => b.urgencyScore - a.urgencyScore);

  let currentPayloadKg = 0;

  for (const entry of scoredItems) {
    const it = entry.item;
    const dailyBurn = Math.max(it.averageDailyConsumption, 0.1);

    // Target: restore inventory to at least 90 days survival buffer
    const targetDays = 90;
    const deficitUnits = Math.max(0, Math.ceil(targetDays * dailyBurn - it.quantity));

    if (deficitUnits <= 0) continue;

    // Check payload weight limits
    const maxAffordableUnits = Math.floor((maxPayloadKg - currentPayloadKg) / entry.unitWeightKg);
    const allocatedUnits = Math.min(deficitUnits, Math.max(1, maxAffordableUnits));

    if (allocatedUnits > 0 && currentPayloadKg + allocatedUnits * entry.unitWeightKg <= maxPayloadKg) {
      const weightContributionKg = Number((allocatedUnits * entry.unitWeightKg).toFixed(1));
      currentPayloadKg += weightContributionKg;

      const postDeliveryDays = Number(((it.quantity + allocatedUnits) / dailyBurn).toFixed(1));

      let rationale = `Replenish ${it.name} to establish a ${postDeliveryDays}-day survival window beyond winter lock-in.`;
      if (it.category === "FUEL") {
        rationale = `Critical Polar Diesel resupply ensuring power and thermal heating through winter minimum reserves.`;
      } else if (it.category === "SPARES") {
        rationale = `Desalination/generator spare parts avoiding single-point life-support degradation.`;
      }

      itemsToLoad.push({
        itemId: it.id,
        itemName: it.name,
        category: it.category,
        allocatedQuantity: allocatedUnits,
        unit: it.unit,
        estimatedWeightKg: weightContributionKg,
        priority: entry.urgencyScore > 25 ? "CRITICAL" : entry.urgencyScore > 10 ? "HIGH" : "MEDIUM",
        expectedPostDeliveryCoverageDays: postDeliveryDays,
        rationale,
      });
    }
  }

  const payloadUtilizationPct = Number(((currentPayloadKg / maxPayloadKg) * 100).toFixed(1));
  const avgPostCoverageDays = itemsToLoad.length > 0
    ? Number(
        (itemsToLoad.reduce((acc, cur) => acc + (cur.expectedPostDeliveryCoverageDays || cur.postDeliveryDaysRemaining || 0), 0) / itemsToLoad.length).toFixed(1)
      )
    : 45;

  return {
    stationId,
    missionId: mission.id,
    missionCode: mission.code || mission.missionCode || "MIS-2026-01",
    totalPayloadKg: Number(currentPayloadKg.toFixed(1)),
    totalAllocatedWeightKg: Number(currentPayloadKg.toFixed(1)),
    maxPayloadCapacityKg: maxPayloadKg,
    maxPayloadKg,
    payloadUtilizationPct,
    winterSurvivalBufferDays: weatherRiskIndex > 0.4 ? 45 : 30,
    recommendedSafetyBufferDays: weatherRiskIndex > 0.4 ? 45 : 30,
    items: itemsToLoad,
    itemsToLoad,
    overallUrgencyRating: payloadUtilizationPct > 80 ? "HIGH" : "NOMINAL",
    expectedMeanCoverageDays: avgPostCoverageDays,
    assumptions: [
      `Assumes vessel/flight payload ceiling of ${maxPayloadKg.toLocaleString()} kg.`,
      `Weather risk coefficient of ${weatherRiskIndex} applied to Antarctic transit buffer.`,
      "Target replenishment objective sets a 90-day baseline runway floor.",
      "Optimized deterministically using urgency-weighted multi-domain heuristic.",
    ],
    calculatedAt: new Date().toISOString(),
    optimizedAt: new Date().toISOString(),
    label: "COMPUTED / DEMO OPTIMIZER",
  };
}
