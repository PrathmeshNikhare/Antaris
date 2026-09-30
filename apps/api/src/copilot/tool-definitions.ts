/**
 * Phase 7 — Operations Copilot Tool Definitions
 *
 * Each tool is:
 *   1. Read-only (no DB writes, no shell commands, no physical control)
 *   2. Maps to an existing Digital Twin / Intelligence API
 *   3. Returns structured JSON that the LLM explains to the operator
 */

export interface CopilotToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

// ── Allowed Tool Names (whitelist) ──────────────────────────────────
export const ALLOWED_TOOLS = [
  "get_station_summary",
  "get_asset_status",
  "get_asset_history",
  "get_alerts",
  "get_energy_state",
  "get_energy_forecast",
  "get_inventory_status",
  "get_environment_summary",
  "get_dependency_impact",
  "get_simulation_result",
  "get_recent_operator_actions",
] as const;

export type AllowedToolName = (typeof ALLOWED_TOOLS)[number];

// ── Tool Schemas for Ollama function calling ────────────────────────
export const COPILOT_TOOLS: CopilotToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_station_summary",
      description:
        "Get a high-level overview of a station including its operational status, number of assets, active alerts, and last sync time. Use when the operator asks about the overall state of Maitri or Bharati.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier, e.g. 'station-maitri' or 'station-bharati'",
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_asset_status",
      description:
        "Get the live Digital Twin state for a specific asset including health score, telemetry readings, anomaly state, and maintenance history. Use when the operator asks about a specific generator, battery, HVAC, or other asset.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
          assetId: {
            type: "string",
            description: "The asset identifier, e.g. 'asset-maitri-gen-1' or 'asset-maitri-batt-1'",
          },
        },
        required: ["stationId", "assetId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_asset_history",
      description:
        "Get recent telemetry history for a specific metric on an asset. Returns time-series data points. Use when the operator asks about trends or recent changes in a metric.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
          metric: {
            type: "string",
            description: "The telemetry metric name, e.g. 'power_output_kw', 'temperature_c', 'fuel_level_liters', 'battery_soc_pct'",
          },
          limit: {
            type: "string",
            description: "Number of recent data points to retrieve (default: 24)",
          },
        },
        required: ["stationId", "metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_alerts",
      description:
        "Get active alerts for a station, optionally filtered by severity. Returns alert title, description, severity, evidence, and recommended action. Use when the operator asks about warnings, issues, or what needs attention.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
          severity: {
            type: "string",
            description: "Optional severity filter",
            enum: ["INFO", "WARNING", "CRITICAL"],
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_energy_state",
      description:
        "Get the current energy grid state: total generation, total load, battery SOC, net power balance, and grid status. Use when the operator asks about power, energy, or electrical status.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_energy_forecast",
      description:
        "Get the 24-hour energy demand and generation forecast with confidence bounds. Shows predicted demand, generation, reserves, and fuel consumption. Use when the operator asks about future energy needs or how long fuel will last.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_status",
      description:
        "Get inventory levels and depletion forecasts for fuel, food, water, medical, and spare parts. Shows days remaining, consumption trends, and resupply urgency. Use when the operator asks about supplies, fuel reserves, or logistics.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_environment_summary",
      description:
        "Get the current environmental conditions: temperature, wind speed, atmospheric pressure, solar irradiance, and weather condition classification. Use when the operator asks about weather or environmental conditions.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dependency_impact",
      description:
        "Get the downstream cascade impact if a specific asset fails. Shows which assets depend on it, failure propagation paths, and max criticality. Use when the operator asks 'what happens if X fails' or about dependencies.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
          assetId: {
            type: "string",
            description: "The asset to analyze impact for",
          },
        },
        required: ["stationId", "assetId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_simulation_result",
      description:
        "Get the most recent what-if resilience simulation result, or run a new simulation for a given scenario. Shows baseline vs scenario comparison, impacted assets, blast radius, and recovery actions. Clearly label results as SIMULATED. Use when the operator asks 'what if' questions about failures.",
      parameters: {
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The station identifier",
          },
          scenarioType: {
            type: "string",
            description: "The scenario to simulate",
            enum: [
              "GENERATOR_FAILURE",
              "BATTERY_DEGRADATION",
              "FUEL_SHORTAGE",
              "EXTREME_COLD",
              "HIGH_WIND",
              "COMMUNICATION_OUTAGE",
            ],
          },
          durationHours: {
            type: "string",
            description: "Optional duration in hours for the scenario",
          },
        },
        required: ["stationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_operator_actions",
      description:
        "Get the recent audit trail of operator actions: who did what, when, and the result. Use when the operator asks about recent activity, who made changes, or what was done previously.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "string",
            description: "Number of recent actions to return (default: 10)",
          },
        },
        required: [],
      },
    },
  },
];
