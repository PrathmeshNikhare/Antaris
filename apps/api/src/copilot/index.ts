export { handleCopilotQuery, checkOllamaHealth } from "./copilot.service";
export type { CopilotResponse, CopilotMessage, ToolCallTrace } from "./copilot.service";
export { COPILOT_TOOLS, ALLOWED_TOOLS } from "./tool-definitions";
export { executeTool } from "./tool-executor";
