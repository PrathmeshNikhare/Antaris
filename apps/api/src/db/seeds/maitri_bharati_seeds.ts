export interface SeedData {
  stations: Array<{
    id: string;
    code: "MAITRI" | "BHARATI";
    name: string;
    locationLabel: string;
    status: "OPERATIONAL" | "DEGRADED" | "OFFLINE" | "MAINTENANCE";
    dataMode: "SIMULATED" | "EXTERNAL" | "MEASURED";
  }>;
  assets: Array<{
    id: string;
    stationId: string;
    parentAssetId?: string;
    code: string;
    name: string;
    type:
      | "GENERATOR"
      | "BATTERY"
      | "HVAC"
      | "BUILDING"
      | "WATER_SYSTEM"
      | "COMMUNICATION"
      | "SOLAR"
      | "VEHICLE"
      | "LAB_EQUIPMENT"
      | "OTHER";
    status: "OPERATIONAL" | "DEGRADED" | "FAILED" | "MAINTENANCE" | "OFFLINE";
    criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    healthScore: number;
  }>;
  telemetry: Array<{
    id: string;
    stationId: string;
    assetId: string;
    metric: string;
    value: number;
    unit: string;
    timestamp: Date;
    source: "SIMULATOR" | "MQTT" | "API" | "MANUAL";
    quality: "GOOD" | "SUSPECT" | "BAD";
  }>;
  inventory: Array<{
    id: string;
    stationId: string;
    category: "FUEL" | "FOOD" | "MEDICAL" | "SPARES" | "SCIENTIFIC";
    name: string;
    quantity: number;
    unit: string;
    minimumThreshold: number;
    averageDailyConsumption: number;
    leadTimeDays: number;
  }>;
  alerts: Array<{
    id: string;
    stationId: string;
    assetId?: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    category: "INFRASTRUCTURE" | "ENERGY" | "LOGISTICS" | "ENVIRONMENT" | "SYSTEM";
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  }>;
  forecasts: Array<{
    id: string;
    stationId: string;
    target: string;
    horizonHours: number;
    predictedValue: number;
    lowerBound: number;
    upperBound: number;
    modelVersion: string;
    generatedAt: Date;
  }>;
  simulations: Array<{
    id: string;
    stationId: string;
    scenarioType: string;
    inputState: Record<string, unknown>;
    outputState: Record<string, unknown>;
    impacts: Record<string, unknown>;
  }>;
}

const now = new Date();

export const maitriBharatiSeedData: SeedData = {
  stations: [
    {
      id: "station-maitri",
      code: "MAITRI",
      name: "Maitri Station",
      locationLabel: "Schirmacher Oasis, Queen Maud Land, Antarctica (70°45′57″S 11°44′09″E)",
      status: "OPERATIONAL",
      dataMode: "SIMULATED",
    },
    {
      id: "station-bharati",
      code: "BHARATI",
      name: "Bharati Station",
      locationLabel: "Larsemann Hills, Princess Elizabeth Land, Antarctica (69°24′28″S 76°11′14″E)",
      status: "OPERATIONAL",
      dataMode: "SIMULATED",
    },
  ],

  assets: [
    // ─── Maitri Station Assets ────────────────────────────────────
    {
      id: "asset-maitri-bld-main",
      stationId: "station-maitri",
      code: "MAITRI-BLD-01",
      name: "Main Living & Operations Module",
      type: "BUILDING",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 92,
    },
    {
      id: "asset-maitri-bld-genhouse",
      stationId: "station-maitri",
      code: "MAITRI-BLD-02",
      name: "Generator House & Mechanical Workshop",
      type: "BUILDING",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 88,
    },
    {
      id: "asset-maitri-gen-1",
      stationId: "station-maitri",
      parentAssetId: "asset-maitri-bld-genhouse",
      code: "MAITRI-GEN-01",
      name: "Primary Diesel Generator 125 kVA",
      type: "GENERATOR",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 89,
    },
    {
      id: "asset-maitri-gen-2",
      stationId: "station-maitri",
      parentAssetId: "asset-maitri-bld-genhouse",
      code: "MAITRI-GEN-02",
      name: "Standby Diesel Generator 125 kVA",
      type: "GENERATOR",
      status: "OPERATIONAL",
      criticality: "HIGH",
      healthScore: 95,
    },
    {
      id: "asset-maitri-bat-1",
      stationId: "station-maitri",
      parentAssetId: "asset-maitri-bld-genhouse",
      code: "MAITRI-BAT-01",
      name: "Central Lithium Battery Storage 60 kWh",
      type: "BATTERY",
      status: "OPERATIONAL",
      criticality: "HIGH",
      healthScore: 94,
    },
    {
      id: "asset-maitri-sol-1",
      stationId: "station-maitri",
      code: "MAITRI-SOL-01",
      name: "Bifacial Solar PV Array 30 kW",
      type: "SOLAR",
      status: "OPERATIONAL",
      criticality: "MEDIUM",
      healthScore: 91,
    },
    {
      id: "asset-maitri-water-1",
      stationId: "station-maitri",
      code: "MAITRI-WTR-01",
      name: "Priyadarshini Lake Water Extraction System",
      type: "WATER_SYSTEM",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 86,
    },
    {
      id: "asset-maitri-hvac-1",
      stationId: "station-maitri",
      parentAssetId: "asset-maitri-bld-main",
      code: "MAITRI-HVAC-01",
      name: "Main Complex Central Heating & Air Handling",
      type: "HVAC",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 87,
    },
    {
      id: "asset-maitri-comm-1",
      stationId: "station-maitri",
      parentAssetId: "asset-maitri-bld-main",
      code: "MAITRI-COM-01",
      name: "Inmarsat / VSAT Polar Satellite Terminal",
      type: "COMMUNICATION",
      status: "OPERATIONAL",
      criticality: "HIGH",
      healthScore: 97,
    },
    {
      id: "asset-maitri-env-1",
      stationId: "station-maitri",
      code: "MAITRI-ENV-01",
      name: "Oasis Automatic Weather Station (AWS)",
      type: "OTHER",
      status: "OPERATIONAL",
      criticality: "MEDIUM",
      healthScore: 98,
    },

    // ─── Bharati Station Assets ───────────────────────────────────
    {
      id: "asset-bharati-bld-main",
      stationId: "station-bharati",
      code: "BHARATI-BLD-01",
      name: "Main Integrated Complex (Modular Stilt)",
      type: "BUILDING",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 96,
    },
    {
      id: "asset-bharati-bld-shelter",
      stationId: "station-bharati",
      code: "BHARATI-BLD-02",
      name: "Emergency Survival Shelter & Helipad Hub",
      type: "BUILDING",
      status: "OPERATIONAL",
      criticality: "HIGH",
      healthScore: 98,
    },
    {
      id: "asset-bharati-chp-1",
      stationId: "station-bharati",
      parentAssetId: "asset-bharati-bld-main",
      code: "BHARATI-CHP-01",
      name: "Combined Heat & Power Tri-generation Unit 1 (100 kW)",
      type: "GENERATOR",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 94,
    },
    {
      id: "asset-bharati-chp-2",
      stationId: "station-bharati",
      parentAssetId: "asset-bharati-bld-main",
      code: "BHARATI-CHP-02",
      name: "Standby Tri-generation CHP Unit 2 (100 kW)",
      type: "GENERATOR",
      status: "OPERATIONAL",
      criticality: "HIGH",
      healthScore: 98,
    },
    {
      id: "asset-bharati-bat-1",
      stationId: "station-bharati",
      parentAssetId: "asset-bharati-bld-main",
      code: "BHARATI-BAT-01",
      name: "High-Capacity Li-ion Battery Bank 120 kWh",
      type: "BATTERY",
      status: "OPERATIONAL",
      criticality: "HIGH",
      healthScore: 97,
    },
    {
      id: "asset-bharati-wnd-1",
      stationId: "station-bharati",
      code: "BHARATI-WND-01",
      name: "Polar Vertical-Axis Wind Turbine Array 20 kW",
      type: "OTHER",
      status: "OPERATIONAL",
      criticality: "MEDIUM",
      healthScore: 90,
    },
    {
      id: "asset-bharati-ro-1",
      stationId: "station-bharati",
      parentAssetId: "asset-bharati-bld-main",
      code: "BHARATI-RO-01",
      name: "Sea-Water Reverse Osmosis Desalination System",
      type: "WATER_SYSTEM",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 93,
    },
    {
      id: "asset-bharati-hvac-1",
      stationId: "station-bharati",
      parentAssetId: "asset-bharati-bld-main",
      code: "BHARATI-HVAC-01",
      name: "Integrated Heat-Recovery Climate Control",
      type: "HVAC",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 95,
    },
    {
      id: "asset-bharati-ground-1",
      stationId: "station-bharati",
      code: "BHARATI-SAT-01",
      name: "ISRO/NRSC Polar Satellite Ground Station & High-Gain Antenna",
      type: "COMMUNICATION",
      status: "OPERATIONAL",
      criticality: "CRITICAL",
      healthScore: 99,
    },
    {
      id: "asset-bharati-env-1",
      stationId: "station-bharati",
      code: "BHARATI-ENV-01",
      name: "Coastal Climate & Oceanic Atmospheric Station",
      type: "OTHER",
      status: "OPERATIONAL",
      criticality: "MEDIUM",
      healthScore: 96,
    },
  ],

  telemetry: [
    // Maitri baseline points
    {
      id: "telem-maitri-001",
      stationId: "station-maitri",
      assetId: "asset-maitri-gen-1",
      metric: "generator_power_output_kw",
      value: 78.4,
      unit: "kW",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
    {
      id: "telem-maitri-002",
      stationId: "station-maitri",
      assetId: "asset-maitri-bat-1",
      metric: "battery_state_of_charge",
      value: 84.5,
      unit: "%",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
    {
      id: "telem-maitri-003",
      stationId: "station-maitri",
      assetId: "asset-maitri-env-1",
      metric: "ambient_temperature",
      value: -14.2,
      unit: "°C",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
    {
      id: "telem-maitri-004",
      stationId: "station-maitri",
      assetId: "asset-maitri-env-1",
      metric: "wind_speed",
      value: 28.5,
      unit: "knots",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },

    // Bharati baseline points
    {
      id: "telem-bharati-001",
      stationId: "station-bharati",
      assetId: "asset-bharati-chp-1",
      metric: "chp_electrical_power_kw",
      value: 64.2,
      unit: "kW",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
    {
      id: "telem-bharati-002",
      stationId: "station-bharati",
      assetId: "asset-bharati-bat-1",
      metric: "battery_state_of_charge",
      value: 91.0,
      unit: "%",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
    {
      id: "telem-bharati-003",
      stationId: "station-bharati",
      assetId: "asset-bharati-env-1",
      metric: "ambient_temperature",
      value: -18.7,
      unit: "°C",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
    {
      id: "telem-bharati-004",
      stationId: "station-bharati",
      assetId: "asset-bharati-env-1",
      metric: "wind_speed",
      value: 36.1,
      unit: "knots",
      timestamp: now,
      source: "SIMULATOR",
      quality: "GOOD",
    },
  ],

  inventory: [
    // Maitri inventory
    {
      id: "inv-maitri-fuel-1",
      stationId: "station-maitri",
      category: "FUEL",
      name: "Arctic Aviation Turbine Fuel (ATF / Jet A-1)",
      quantity: 145000,
      unit: "liters",
      minimumThreshold: 40000,
      averageDailyConsumption: 850,
      leadTimeDays: 90,
    },
    {
      id: "inv-maitri-food-1",
      stationId: "station-maitri",
      category: "FOOD",
      name: "Freeze-Dried & Canned Rations",
      quantity: 3200,
      unit: "kg",
      minimumThreshold: 800,
      averageDailyConsumption: 24,
      leadTimeDays: 120,
    },
    {
      id: "inv-maitri-med-1",
      stationId: "station-maitri",
      category: "MEDICAL",
      name: "Hypothermia & Extreme Cold Medical Kits",
      quantity: 45,
      unit: "kits",
      minimumThreshold: 15,
      averageDailyConsumption: 0.1,
      leadTimeDays: 90,
    },
    {
      id: "inv-maitri-spares-1",
      stationId: "station-maitri",
      category: "SPARES",
      name: "Diesel Generator Oil & Fuel Filters",
      quantity: 36,
      unit: "units",
      minimumThreshold: 12,
      averageDailyConsumption: 0.2,
      leadTimeDays: 180,
    },
    {
      id: "inv-maitri-sci-1",
      stationId: "station-maitri",
      category: "SCIENTIFIC",
      name: "Ozone Sonde Radiometers & Cryo Sensors",
      quantity: 50,
      unit: "units",
      minimumThreshold: 10,
      averageDailyConsumption: 0.3,
      leadTimeDays: 120,
    },

    // Bharati inventory
    {
      id: "inv-bharati-fuel-1",
      stationId: "station-bharati",
      category: "FUEL",
      name: "Low-Temperature Arctic High-Flash Diesel",
      quantity: 185000,
      unit: "liters",
      minimumThreshold: 50000,
      averageDailyConsumption: 720,
      leadTimeDays: 90,
    },
    {
      id: "inv-bharati-food-1",
      stationId: "station-bharati",
      category: "FOOD",
      name: "Cryogenic Storage & Dehydrated Provisions",
      quantity: 4100,
      unit: "kg",
      minimumThreshold: 1000,
      averageDailyConsumption: 28,
      leadTimeDays: 120,
    },
    {
      id: "inv-bharati-med-1",
      stationId: "station-bharati",
      category: "MEDICAL",
      name: "Hyperbaric & Surgical Field Supplies",
      quantity: 55,
      unit: "kits",
      minimumThreshold: 20,
      averageDailyConsumption: 0.1,
      leadTimeDays: 90,
    },
    {
      id: "inv-bharati-spares-1",
      stationId: "station-bharati",
      category: "SPARES",
      name: "Desalination RO High-Pressure Membranes",
      quantity: 24,
      unit: "membranes",
      minimumThreshold: 6,
      averageDailyConsumption: 0.05,
      leadTimeDays: 180,
    },
    {
      id: "inv-bharati-sci-1",
      stationId: "station-bharati",
      category: "SCIENTIFIC",
      name: "Ground Station Cryogenic Low-Noise Amplifiers",
      quantity: 12,
      unit: "units",
      minimumThreshold: 4,
      averageDailyConsumption: 0.02,
      leadTimeDays: 180,
    },
  ],

  alerts: [
    {
      id: "alert-maitri-001",
      stationId: "station-maitri",
      assetId: "asset-maitri-water-1",
      severity: "WARNING",
      category: "INFRASTRUCTURE",
      title: "Lake Intake Heating Trace Current Low",
      description:
        "Sub-zero thermal trace heating line on Lake Priyadarshini conduit is drawing 15% below nominal current. Risk of frazil ice formation.",
      evidence: { currentAmps: 8.2, nominalAmps: 9.8, ambientTemp: -14.2 },
      status: "OPEN",
    },
    {
      id: "alert-bharati-001",
      stationId: "station-bharati",
      assetId: "asset-bharati-ground-1",
      severity: "INFO",
      category: "SYSTEM",
      title: "Scheduled Polar Satellite Pass Tracking Lock Acquired",
      description:
        "NRSC remote sensing payload pass successfully tracked and demodulated with zero packet loss.",
      evidence: { satellite: "CARTOSAT-3", snrDb: 18.4, azimuthDeg: 142.1 },
      status: "OPEN",
    },
  ],

  forecasts: [
    {
      id: "fc-maitri-energy-001",
      stationId: "station-maitri",
      target: "energy_demand_kw",
      horizonHours: 24,
      predictedValue: 82.5,
      lowerBound: 76.0,
      upperBound: 91.0,
      modelVersion: "v1.0.0-baseline-sarima",
      generatedAt: now,
    },
    {
      id: "fc-bharati-wind-001",
      stationId: "station-bharati",
      target: "wind_generation_kw",
      horizonHours: 24,
      predictedValue: 14.8,
      lowerBound: 8.2,
      upperBound: 19.5,
      modelVersion: "v1.0.0-wind-gbm",
      generatedAt: now,
    },
  ],

  simulations: [
    {
      id: "sim-maitri-genfailover-001",
      stationId: "station-maitri",
      scenarioType: "GENERATOR_FAILURE",
      inputState: {
        failedAssetId: "asset-maitri-gen-1",
        backupAssetId: "asset-maitri-gen-2",
        ambientTemperature: -20.0,
      },
      outputState: {
        switchoverLatencySeconds: 12,
        batteryDipPercent: 4.2,
        nonCriticalLoadShedKw: 15.0,
      },
      impacts: {
        estimatedFuelImpactLiters: -120,
        riskScore: "LOW",
        stationContinuitySecured: true,
      },
    },
    {
      id: "sim-bharati-weather-001",
      stationId: "station-bharati",
      scenarioType: "EXTREME_WEATHER",
      inputState: {
        windSpeedKnots: 75.0,
        temperatureCelsius: -32.0,
        durationHours: 48,
      },
      outputState: {
        turbineBrakingEngaged: true,
        chpThermalSharePercent: 88,
        batteryReserveDays: 3.5,
      },
      impacts: {
        logisticsAccessBlocked: true,
        structuralStressIndex: 0.42,
        stationContinuitySecured: true,
      },
    },
  ],
};
