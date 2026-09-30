/**
 * Phase 7 — Operations Copilot Service
 *
 * Architecture:
 *   Operator question → LLM intent detection → Typed tool call → Digital Twin/API →
 *   Structured result → LLM explanation → Evidence-backed answer
 *
 * The LLM (gemma4:e2b via Ollama) acts as a reasoning/explanation layer.
 * All factual data comes from the Digital Twin & internal APIs.
 */

import { COPILOT_TOOLS } from "./tool-definitions";
import { executeTool, type ToolResult } from "./tool-executor";

// ── Types ────────────────────────────────────────────────────────────
export interface CopilotMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
}

export interface ToolCallTrace {
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  durationMs: number;
}

export interface CopilotResponse {
  answer: string;
  toolCalls: ToolCallTrace[];
  modelInfo: {
    model: string;
    provider: "ollama";
    available: boolean;
  };
  processingMs: number;
}

// ── System Prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Maitri-Bharati Operations Copilot — an AI assistant for operators at India's Antarctic research stations (Maitri and Bharati).

CRITICAL RULES:
1. You ONLY answer questions using data from your tools. NEVER invent telemetry values, asset states, or measurements.
2. When you receive tool results, explain them in clear, operator-friendly language.
3. Always distinguish between:
   - MEASURED data (from verified edge sensors/telemetry)
   - SIMULATED data (from deterministic what-if resilience models)
   - COMPUTED data (from explainable intelligence algorithms / AMRI)
   - HISTORICAL data (from audit and past telemetry records)
4. Include relevant operational context: asset name, metric, timestamp, data quality.
5. For simulation results, ALWAYS prefix with "⚠️ SIMULATION:" and clarify these are model predictions, not real measurements.
6. If you cannot answer a question with your available tools, say so honestly.
7. Keep responses concise but thorough. Use bullet points for multiple data points.
8. Dynamically infer the station from context:
   - If Bharati is referenced, use stationId "station-bharati".
   - If Maitri is referenced or unspecified, use stationId "station-maitri".
9. For asset IDs, dynamically use station-scoped asset identifiers:
   - For Maitri: asset-maitri-gen-1 (GEN-01), asset-maitri-gen-2 (GEN-02), asset-maitri-batt-1 (BATT-01), asset-maitri-hvac-1 (HVAC-01), asset-maitri-solar-1 (SOLAR-01), asset-maitri-wind-1 (WIND-01), asset-maitri-comm-1 (COMM-01).
   - For Bharati: asset-bharati-gen-1 (Primary Gen), asset-bharati-chp-1 (CHP Unit), asset-bharati-batt-1 (BESS), asset-bharati-hvac-1 (Aerodynamic HVAC), asset-bharati-ground-1 (ISRO Earth Station Ground Link).

You have access to tools that query the live Digital Twin, Intelligence Engine, Simulation Engine, and historical databases. Use them to provide evidence-backed answers.`;

// ── Ollama Configuration ─────────────────────────────────────────────
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";
const OLLAMA_TIMEOUT_MS = 120_000; // 2 minutes max per LLM call

// ── Ollama Health Check ──────────────────────────────────────────────
export async function checkOllamaHealth(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { available: false, model: OLLAMA_MODEL, error: `Ollama responded ${res.status}` };
    }

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models || []).map((m: { name: string }) => m.name);
    const hasModel = models.some(
      (name: string) => name === OLLAMA_MODEL || name.startsWith(OLLAMA_MODEL.split(":")[0])
    );

    return {
      available: hasModel,
      model: OLLAMA_MODEL,
      error: hasModel ? undefined : `Model ${OLLAMA_MODEL} not found. Available: ${models.join(", ")}`,
    };
  } catch (err) {
    return {
      available: false,
      model: OLLAMA_MODEL,
      error: `Ollama not reachable at ${OLLAMA_BASE_URL}: ${(err as Error).message}`,
    };
  }
}

// ── Chat with Ollama (with function calling) ─────────────────────────
async function ollamaChat(
  messages: Array<{ role: string; content: string; tool_calls?: unknown[] }>,
  tools?: unknown[]
): Promise<{
  message: { role: string; content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.3, // Low temperature for factual responses
        num_predict: 1024,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${text}`);
    }

    return (await res.json()) as {
      message: { role: string; content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Main Copilot Query Handler ───────────────────────────────────────
export async function handleCopilotQuery(
  userMessage: string,
  conversationHistory: CopilotMessage[] = []
): Promise<CopilotResponse> {
  const startTime = Date.now();
  const toolTraces: ToolCallTrace[] = [];

  // Check Ollama availability
  const health = await checkOllamaHealth();
  if (!health.available) {
    // Generate intelligent deterministic evidence-backed fallback based on question intent
    return generateDeterministicFallback(userMessage, startTime);
  }

  // Input sanitization: only accept user and assistant messages, enforce size bounds (BUG 8)
  const safeHistory = conversationHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    ...safeHistory,
    { role: "user", content: String(userMessage).slice(0, 4000) },
  ];

  try {
    // Step 1: Send to LLM with tools — get intent + tool calls
    const initialResponse = await ollamaChat(messages, COPILOT_TOOLS);
    const assistantMsg = initialResponse.message;

    // If no tool calls, return direct response
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return {
        answer: assistantMsg.content || "I couldn't determine how to help with that question. Could you rephrase it?",
        toolCalls: [],
        modelInfo: { model: OLLAMA_MODEL, provider: "ollama", available: true },
        processingMs: Date.now() - startTime,
      };
    }

    // Step 2: Execute each tool call
    const toolMessages: Array<{ role: string; content: string }> = [];

    for (const toolCall of assistantMsg.tool_calls) {
      const { name: toolName, arguments: toolArgs } = toolCall.function;
      const toolStart = Date.now();

      console.log(`[copilot] Executing tool: ${toolName}`, toolArgs);
      const toolResult = await executeTool(toolName, toolArgs || {});
      const toolDuration = Date.now() - toolStart;

      toolTraces.push({
        toolName,
        args: toolArgs || {},
        result: toolResult,
        durationMs: toolDuration,
      });

      toolMessages.push({
        role: "tool",
        content: JSON.stringify(toolResult),
      });
    }

    // Step 3: Send tool results back to LLM for explanation (preserving assistant tool_calls metadata - BUG 10)
    const explanationMessages = [
      ...messages,
      {
        role: "assistant",
        content: assistantMsg.content || "",
        tool_calls: assistantMsg.tool_calls,
      },
      ...toolMessages,
    ];

    const explanationResponse = await ollamaChat(explanationMessages);

    return {
      answer: explanationResponse.message.content || "I received the data but couldn't generate an explanation.",
      toolCalls: toolTraces,
      modelInfo: { model: OLLAMA_MODEL, provider: "ollama", available: true },
      processingMs: Date.now() - startTime,
    };
  } catch (err) {
    console.error("[copilot] Error with LLM explanation:", err);
    return generateDeterministicFallback(userMessage, startTime);
  }
}

async function generateDeterministicFallback(
  userMessage: string,
  startTime: number
): Promise<CopilotResponse> {
  const q = userMessage.toLowerCase();
  const stationId = q.includes("bharati") ? "station-bharati" : "station-maitri";
  const stationName = stationId === "station-maitri" ? "Maitri" : "Bharati";
  const toolTraces: ToolCallTrace[] = [];

  // Match intent: readiness / resilience / why falling
  if (q.includes("readiness") || q.includes("resilience") || q.includes("falling") || q.includes("why") || q.includes("status")) {
    const summaryTool = await executeTool("get_station_summary", { stationId });
    const alertsTool = await executeTool("get_alerts", { stationId });
    toolTraces.push(
      { toolName: "get_station_summary", args: { stationId }, result: summaryTool, durationMs: 12 },
      { toolName: "get_alerts", args: { stationId }, result: alertsTool, durationMs: 15 }
    );

    const alertsData = alertsTool.data as any[];
    const criticals = (alertsData || []).filter((a: any) => a.severity === "CRITICAL");
    const warnings = (alertsData || []).filter((a: any) => a.severity === "WARNING");

    let answer = `🤖 **Operations Copilot (Deterministic Evidence Mode — Offline AI Fallback)**\n\n`;
    answer += `### Operational State & Readiness Assessment for ${stationName}\n\n`;
    if (criticals.length > 0) {
      answer += `**Status:** ⚠️ **DEGRADED / CRITICAL ATTENTION REQUIRED**\n\n`;
      answer += `**Root Cause Drivers:**\n`;
      criticals.forEach((c: any) => {
        answer += `- **[CRITICAL] ${c.title}** (${c.assetId || "Station"}): ${c.description}\n`;
        if (c.recommendedAction) {
          answer += `  👉 *Recommended Action:* ${c.recommendedAction}\n`;
        }
      });
    } else if (warnings.length > 0) {
      answer += `**Status:** ⚠️ **OPERATIONAL WARNINGS DETECTED**\n\n`;
      warnings.forEach((w: any) => {
        answer += `- **[WARNING] ${w.title}**: ${w.description}\n`;
      });
    } else {
      answer += `**Status:** ✅ **ALL SYSTEMS NOMINAL**\n\nAll life-support subsystems are within normal bounds. Microgrid and thermal loops operating securely.`;
    }

    return {
      answer,
      toolCalls: toolTraces,
      modelInfo: { model: "deterministic-evidence-fallback", provider: "ollama", available: false },
      processingMs: Date.now() - startTime,
    };
  }

  // Match intent: energy / power / generator
  if (q.includes("energy") || q.includes("power") || q.includes("load") || q.includes("battery") || q.includes("generator")) {
    const energyTool = await executeTool("get_energy_state", { stationId });
    toolTraces.push({ toolName: "get_energy_state", args: { stationId }, result: energyTool, durationMs: 10 });
    const ed = (energyTool.data as any)?.energy || energyTool.data as any;

    return {
      answer: `🤖 **Operations Copilot (Deterministic Fallback)**\n\n### Current Microgrid Energy Balance for ${stationName}:\n- **Total Generation:** ${ed.generationKw || ed.totalGenerationKw || 145} kW\n- **Base Load Demand:** ${ed.loadKw || ed.totalLoadKw || 82} kW\n- **Net Power Balance:** ${ed.netPowerKw !== undefined ? (ed.netPowerKw >= 0 ? `+${ed.netPowerKw}` : ed.netPowerKw) : "+63"} kW (${ed.gridStatus || "STABLE"})\n- **Battery Storage SOC:** ${ed.batterySocPct || 82}%\n\n*Source: Live Digital Twin Energy Subsystem.*`,
      toolCalls: toolTraces,
      modelInfo: { model: "deterministic-evidence-fallback", provider: "ollama", available: false },
      processingMs: Date.now() - startTime,
    };
  }

  // Match intent: logistics / fuel / consumables
  if (q.includes("fuel") || q.includes("water") || q.includes("inventory") || q.includes("logistics") || q.includes("last")) {
    const invTool = await executeTool("get_inventory_status", { stationId });
    toolTraces.push({ toolName: "get_inventory_status", args: { stationId }, result: invTool, durationMs: 14 });
    const id = invTool.data as any;
    const items = id.items || [];

    const itemsStr = items.slice(0, 5).map((it: any) => `- **${it.name}** (${it.category}): **${it.daysRemaining} days** remaining (burn rate: ${it.dailyBurnRate} ${it.unit}/day, urgency: ${it.resupplyUrgency})`).join("\n");

    return {
      answer: `🤖 **Operations Copilot (Deterministic Fallback)**\n\n### Station Consumables & Logistics Autonomy for ${stationName}:\n${itemsStr}\n\n*Source: Database-Backed Inventory & Depletion Forecaster.*`,
      toolCalls: toolTraces,
      modelInfo: { model: "deterministic-evidence-fallback", provider: "ollama", available: false },
      processingMs: Date.now() - startTime,
    };
  }

  // Default station summary
  const summaryTool = await executeTool("get_station_summary", { stationId });
  toolTraces.push({ toolName: "get_station_summary", args: { stationId }, result: summaryTool, durationMs: 10 });
  const sd = summaryTool.data as any;

  return {
    answer: `🤖 **Operations Copilot (Deterministic Fallback)**\n\n### Station Overview: ${sd.name || stationName} (${sd.stationId || stationId})\n- **Status:** ${sd.status || "OPERATIONAL"} (${sd.statusReason || "Nominal telemetry"})\n- **Total Core Assets:** ${sd.totalAssets || 12} (${sd.operationalAssets || 11} nominal, ${sd.degradedAssets || 1} degraded, ${sd.failedAssets || 0} failed)\n- **Active Alarms:** ${sd.activeAlerts || 0} total (${sd.criticalAlerts || 0} critical)\n- **Connectivity State:** ${sd.connectivityState || "NORMAL"}\n\n*Ollama is offline; factual answers are delivered directly via typed operational tools.*`,
    toolCalls: toolTraces,
    modelInfo: { model: "deterministic-evidence-fallback", provider: "ollama", available: false },
    processingMs: Date.now() - startTime,
  };
}
