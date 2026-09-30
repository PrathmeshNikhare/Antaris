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
   - MEASURED data (from sensors/telemetry)
   - SIMULATED data (from what-if models)
   - COMPUTED data (from intelligence algorithms)
   - HISTORICAL data (from audit/database records)
4. Include relevant context: asset name, metric, timestamp, data quality.
5. For simulation results, ALWAYS prefix with "⚠️ SIMULATION:" and clarify these are model predictions, not measurements.
6. If you cannot answer a question with your available tools, say so honestly.
7. Keep responses concise but thorough. Use bullet points for multiple data points.
8. Default to station "station-maitri" unless the operator specifies Bharati.
9. For asset IDs, use the format "asset-maitri-gen-1", "asset-maitri-batt-1", etc. Common assets:
   - GEN-01: asset-maitri-gen-1 (Primary Generator)
   - GEN-02: asset-maitri-gen-2 (Secondary Generator)
   - BATT-01: asset-maitri-batt-1 (Battery Bank)
   - HVAC-01: asset-maitri-hvac-1 (HVAC System)
   - COMM-01: asset-maitri-comm-1 (Communications)
   - SOLAR-01: asset-maitri-solar-1 (Solar Array)

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

    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);
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
  messages: Array<{ role: string; content: string }>,
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

    return await res.json();
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
    return {
      answer: `🔌 **Copilot Unavailable**\n\nThe AI Operations Copilot is currently offline. ${health.error || "Ollama service not reachable."}\n\n*The dashboard remains fully operational. All telemetry, alerts, simulations, and intelligence features continue to work without the copilot.*`,
      toolCalls: [],
      modelInfo: { model: OLLAMA_MODEL, provider: "ollama", available: false },
      processingMs: Date.now() - startTime,
    };
  }

  // Build message array for Ollama
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
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

    // Step 3: Send tool results back to LLM for explanation
    const explanationMessages = [
      ...messages,
      {
        role: "assistant",
        content: assistantMsg.content || "",
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
    console.error("[copilot] Error:", err);

    // If tools were already executed, provide a structured fallback
    if (toolTraces.length > 0) {
      const fallbackParts = toolTraces.map((t) => {
        if (t.result.success) {
          return `**${t.toolName}**: ${JSON.stringify(t.result.data, null, 2).slice(0, 500)}`;
        }
        return `**${t.toolName}**: Error — ${t.result.error}`;
      });

      return {
        answer: `I was able to gather the following data but couldn't generate a natural language explanation:\n\n${fallbackParts.join("\n\n")}\n\n*The LLM explanation step encountered an error: ${(err as Error).message}*`,
        toolCalls: toolTraces,
        modelInfo: { model: OLLAMA_MODEL, provider: "ollama", available: true },
        processingMs: Date.now() - startTime,
      };
    }

    return {
      answer: `An error occurred while processing your query: ${(err as Error).message}. Please try again or rephrase your question.`,
      toolCalls: [],
      modelInfo: { model: OLLAMA_MODEL, provider: "ollama", available: true },
      processingMs: Date.now() - startTime,
    };
  }
}
