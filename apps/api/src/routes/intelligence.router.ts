import { Router, Request, Response } from "express";
import { intelligenceService } from "../intelligence";
import type { ApiResponse } from "@maitri-bharati/shared";

export function createIntelligenceRouter(): Router {
  const router = Router();

  // ── GET Full Intelligence Summary ───────────────────────────────
  router.get("/:stationId/intelligence", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const summary = await intelligenceService.getStationIntelligence(stationId);
      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
        meta: { timestamp: new Date().toISOString() },
      };
      res.json(response);
    } catch (err) {
      console.error("[intelligence.router] Error generating intelligence:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTELLIGENCE_FAILED",
          message: "Failed to evaluate station intelligence summary",
        },
      });
    }
  });

  // ── GET Active Anomalies ────────────────────────────────────────
  router.get("/:stationId/intelligence/anomalies", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const anomalies = intelligenceService.anomalyService.getActiveAnomalies(stationId);
      res.json({
        success: true,
        data: anomalies,
        meta: { timestamp: new Date().toISOString(), total: anomalies.length },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "ANOMALIES_QUERY_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── POST Evaluate Anomaly on Telemetry Point ────────────────────
  router.post("/:stationId/intelligence/anomalies/evaluate", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const point = { ...req.body, stationId };
      const thresholds = req.body.thresholds;
      const result = intelligenceService.evaluateTelemetry(point, thresholds);
      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: "EVALUATION_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── GET 24h Energy Forecast ────────────────────────────────────
  router.get("/:stationId/intelligence/forecasts/energy", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const summary = await intelligenceService.getStationIntelligence(stationId);
      res.json({
        success: true,
        data: summary.energyForecast,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "ENERGY_FORECAST_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── GET Inventory Depletion Forecasts ───────────────────────────
  router.get("/:stationId/intelligence/forecasts/inventory", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const summary = await intelligenceService.getStationIntelligence(stationId);
      res.json({
        success: true,
        data: summary.inventoryForecasts,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "INVENTORY_FORECAST_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── GET Asset Health Scores ─────────────────────────────────────
  router.get("/:stationId/intelligence/health", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const summary = await intelligenceService.getStationIntelligence(stationId);
      res.json({
        success: true,
        data: summary.assetHealthScores,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "HEALTH_EVALUATION_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── GET Cross-Domain Risk Assessment ────────────────────────────
  router.get("/:stationId/intelligence/risk", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const summary = await intelligenceService.getStationIntelligence(stationId);
      res.json({
        success: true,
        data: summary.crossDomainRisk,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "RISK_ASSESSMENT_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── GET Advisory Recommendations ────────────────────────────────
  router.get("/:stationId/intelligence/recommendations", async (req: Request, res: Response) => {
    try {
      const { stationId } = req.params;
      const summary = await intelligenceService.getStationIntelligence(stationId);
      res.json({
        success: true,
        data: summary.recommendations,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "RECOMMENDATIONS_FAILED", message: (err as Error).message },
      });
    }
  });

  // ── GET Model Observability Records ─────────────────────────────
  router.get("/:stationId/intelligence/observability", async (_req: Request, res: Response) => {
    try {
      const records = intelligenceService.modelRegistry.listRecords({ limit: 50 });
      res.json({
        success: true,
        data: records,
        meta: { timestamp: new Date().toISOString(), total: records.length },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "OBSERVABILITY_QUERY_FAILED", message: (err as Error).message },
      });
    }
  });

  return router;
}
