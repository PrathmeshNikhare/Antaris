import { Router, Request, Response } from "express";
import { OperatorRepository } from "../repositories";
import { verifyPassword, hashPassword, createToken } from "../auth/crypto";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import type { AuthUser, OperatorRole } from "@maitri-bharati/shared";

export function createAuthRouter(): Router {
  const router = Router();
  const operatorRepo = new OperatorRepository();

  /**
   * POST /api/auth/login
   * Authenticates operator and sets secure HTTP-only session cookie
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: "Username and password are required." },
        });
        return;
      }

      const operator = await operatorRepo.findByUsernameWithAuth(String(username).trim().toLowerCase());
      if (!operator || !operator.passwordHash) {
        // Fallback for default demo accounts if not seeded yet
        res.status(401).json({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." },
        });
        return;
      }

      const isValid = verifyPassword(String(password), operator.passwordHash);
      if (!isValid) {
        res.status(401).json({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." },
        });
        return;
      }

      const authUser: AuthUser = {
        id: operator.id,
        username: operator.username,
        fullName: operator.fullName,
        role: operator.role,
        stationId: operator.stationId,
        email: operator.email,
      };

      const token = createToken(authUser);
      const isProd = process.env.NODE_ENV === "production";

      // Set secure HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: "/",
      });

      res.json({
        success: true,
        data: {
          user: authUser,
          token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { code: "AUTH_ERROR", message: String(err) },
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Clears the session cookie
   */
  router.post("/logout", (_req: Request, res: Response) => {
    res.clearCookie("auth_token", { path: "/" });
    res.json({ success: true, message: "Session successfully terminated." });
  });

  /**
   * GET /api/auth/me
   * Returns authenticated operator profile and permissions
   */
  router.get("/me", requireAuth, (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        user: req.user,
        permissions: {
          role: req.user?.role,
          stationScope: req.user?.stationId || "ALL_STATIONS",
          canAcknowledgeAlerts: req.user?.role !== "VIEWER",
          canRunSimulations: ["ADMIN", "ENGINEER", "OPERATOR"].includes(req.user?.role || ""),
          canManageLogistics: ["ADMIN", "LOGISTICS"].includes(req.user?.role || ""),
          canConfigureSettings: req.user?.role === "ADMIN",
        },
      },
    });
  });

  /**
   * GET /api/auth/operators (Admin only)
   */
  router.get("/operators", requireAuth, requireRole("ADMIN"), async (_req: Request, res: Response) => {
    try {
      const ops = await operatorRepo.findAll();
      res.json({ success: true, data: ops });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  /**
   * POST /api/auth/operators (Admin only)
   * Provisions or updates an operator with password
   */
  router.post("/operators", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
    try {
      const { id, username, fullName, role, stationId, password, email } = req.body;
      if (!username || !fullName || !role) {
        res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } });
        return;
      }

      const passwordHash = password ? hashPassword(password) : undefined;
      const op = await operatorRepo.insert(
        {
          id: id || `op-${username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`,
          username: String(username).toLowerCase().trim(),
          fullName,
          role: role as OperatorRole,
          stationId: stationId || undefined,
          createdAt: new Date(),
        },
        passwordHash,
        email
      );

      res.status(201).json({ success: true, data: op });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: String(err) } });
    }
  });

  return router;
}
