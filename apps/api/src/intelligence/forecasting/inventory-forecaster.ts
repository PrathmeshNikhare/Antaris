import type { InventoryForecast, TwinState } from "@maitri-bharati/shared";

interface InventoryItemState {
  itemCode: string;
  itemName: string;
  category: "FUEL" | "WATER" | "FOOD" | "SPARES";
  currentQuantity: number;
  unit: string;
  baselineDailyRate: number;
  criticalReservePct: number; // e.g. 0.20 (20%)
}

export class InventoryForecaster {
  /**
   * Generates inventory depletion forecasts across critical commodities (Fuel, Water, Food, Spares).
   */
  public forecast(
    stationId: string,
    currentTwinState?: Partial<TwinState>,
    referenceTime: Date = new Date()
  ): InventoryForecast[] {
    const isMaitri = stationId.toLowerCase().includes("maitri");

    // Dynamic burn adjustment based on ambient temp and power draw
    const ambient = currentTwinState?.environment?.ambientTempC ?? -20.0;
    const coldPenaltyFactor = ambient < -25.0 ? 1.0 + Math.abs(ambient + 25.0) * 0.02 : 1.0;

    // Check live telemetry stream for daily_fuel_burn_liters
    let liveDailyBurn: number | undefined;
    if (currentTwinState?.assets) {
      for (const asset of currentTwinState.assets) {
        const telem = asset.currentTelemetry;
        if (telem?.daily_fuel_burn_liters?.value) {
          liveDailyBurn = telem.daily_fuel_burn_liters.value;
          break;
        }
      }
    }

    // Dynamic fuel burn rate based on actual operating load and weather
    const liveLoad = currentTwinState?.energy?.totalLoadKw;
    const nominalKw = isMaitri ? 45.0 : 60.0;
    const loadFactor = liveLoad ? Math.max(0.75, Math.min(1.8, liveLoad / nominalKw)) : 1.0;

    const dynamicFuelRate = liveDailyBurn
      ? liveDailyBurn * coldPenaltyFactor
      : (isMaitri ? 820 : 1050) * coldPenaltyFactor * loadFactor;

    // Default stock profiles based on actual Antarctic station tank capacities
    const items: InventoryItemState[] = [
      {
        itemCode: "INV-FUEL-DIESEL",
        itemName: "Polar Jet A-1 / Winter Diesel Fuel",
        category: "FUEL",
        // Maitri ~140,000 L tankage, Bharati ~180,000 L tankage
        currentQuantity: isMaitri ? 118500 : 152000,
        unit: "L",
        baselineDailyRate: Number(dynamicFuelRate.toFixed(1)),
        criticalReservePct: 0.25, // 25% minimum survival reserve
      },
      {
        itemCode: "INV-WATER-POTABLE",
        itemName: "Potable Fresh Water Reserve",
        category: "WATER",
        currentQuantity: isMaitri ? 38500 : 54000,
        unit: "L",
        baselineDailyRate: isMaitri ? 650 : 850,
        criticalReservePct: 0.15,
      },
      {
        itemCode: "INV-RATIONS-EXP",
        itemName: "Expedition Emergency Rations",
        category: "FOOD",
        currentQuantity: isMaitri ? 7200 : 9600,
        unit: "RATION_DAYS",
        baselineDailyRate: isMaitri ? 25 : 35, // based on overwintering crew size
        criticalReservePct: 0.20,
      },
      {
        itemCode: "INV-SPARES-GEN-FLT",
        itemName: "Diesel Generator Oil/Fuel Filter Elements",
        category: "SPARES",
        currentQuantity: isMaitri ? 42 : 58,
        unit: "UNITS",
        baselineDailyRate: 0.14, // ~1 filter every 7 days across gensets
        criticalReservePct: 0.20,
      },
    ];

    const nowMs = referenceTime.getTime();

    return items.map((item) => {
      const dailyBurn = Number(item.baselineDailyRate.toFixed(2));
      const daysRemaining = Number((item.currentQuantity / dailyBurn).toFixed(1));
      const depletionDate = new Date(nowMs + daysRemaining * 86400 * 1000).toISOString();

      // Threshold crossing: when quantity drops to critical reserve
      const criticalReserveQty = item.currentQuantity * item.criticalReservePct;
      const usableQtyBeforeReserve = Math.max(0, item.currentQuantity - criticalReserveQty);
      const daysToReserveCrossing = Number((usableQtyBeforeReserve / dailyBurn).toFixed(1));
      const thresholdCrossingDate = new Date(
        nowMs + daysToReserveCrossing * 86400 * 1000
      ).toISOString();

      // Consumption trend assessment
      let consumptionTrend: InventoryForecast["consumptionTrend"] = "STEADY";
      if (coldPenaltyFactor > 1.05) {
        consumptionTrend = "ACCELERATING";
      } else if (coldPenaltyFactor < 0.95) {
        consumptionTrend = "DECELERATING";
      }

      // Lead-time risk: Antarctic winter supply window is typically 180 to 240 days away
      let leadTimeRisk: InventoryForecast["leadTimeRisk"] = "LOW";
      let resupplyUrgency: InventoryForecast["resupplyUrgency"] = "ROUTINE";

      if (daysToReserveCrossing < 45) {
        leadTimeRisk = "CRITICAL";
        resupplyUrgency = "EMERGENCY";
      } else if (daysToReserveCrossing < 90) {
        leadTimeRisk = "HIGH";
        resupplyUrgency = "URGENT";
      } else if (daysToReserveCrossing < 150) {
        leadTimeRisk = "ELEVATED";
        resupplyUrgency = "ATTENTION";
      }

      return {
        stationId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category,
        currentQuantity: Math.round(item.currentQuantity),
        unit: item.unit,
        dailyBurnRate: dailyBurn,
        daysRemaining,
        depletionDate,
        thresholdCrossingDate,
        consumptionTrend,
        leadTimeRisk,
        resupplyUrgency,
        generatedAt: referenceTime.toISOString(),
      };
    });
  }
}
