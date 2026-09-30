import { Router, Request, Response } from "express";
import { handleCopilotQuery, checkOllamaHealth, COPILOT_TOOLS, ALLOWED_TOOLS } from "../copilot";

export function createCopilotRouter(): Router {
  const router = Router();

  // ── POST /api/copilot/chat — Send a message to the Operations Copilot ──
  router.post("/chat", async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_MESSAGE",
            message: "A non-empty 'message' string is required",
          },
        });
        return;
      }

      // Enforce max message length (prevent abuse)
      if (message.length > 2000) {
        res.status(400).json({
          success: false,
          error: {
            code: "MESSAGE_TOO_LONG",
            message: "Message must be 2000 characters or less",
          },
        });
        return;
      }

      const response = await handleCopilotQuery(message.trim(), conversationHistory);

      res.json({
        success: true,
        data: response,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      console.error("[copilot.router] Error:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "COPILOT_ERROR",
          message: (err as Error).message || "Internal copilot error",
        },
      });
    }
  });

  // ── GET /api/copilot/health — Check Ollama/LLM availability ──
  router.get("/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkOllamaHealth();
      res.json({
        success: true,
        data: {
          ...health,
          toolCount: ALLOWED_TOOLS.length,
          tools: ALLOWED_TOOLS,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: "HEALTH_CHECK_FAILED",
          message: (err as Error).message,
        },
      });
    }
  });

  // ── GET /api/copilot/tools — List available tools (for UI transparency) ──
  router.get("/tools", (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: COPILOT_TOOLS.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
      meta: {
        total: COPILOT_TOOLS.length,
        timestamp: new Date().toISOString(),
        notice: "All tools are read-only. The copilot cannot modify station state.",
      },
    });
  });

  return router;
}
