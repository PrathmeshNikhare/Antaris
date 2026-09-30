import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./crypto";
import type { AuthUser, OperatorRole } from "@maitri-bharati/shared";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Extracts and verifies authentication token from HTTP-only cookie or Authorization header
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check HTTP cookie
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").map((c) => c.trim());
    const authCookie = cookies.find((c) => c.startsWith("auth_token="));
    if (authCookie) {
      token = authCookie.substring("auth_token=".length);
    }
  }

  // 2. Fallback to Authorization: Bearer <token>
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.substring(7);
  }

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * Rejects unauthenticated requests with HTTP 401
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Please log in with valid operations credentials.",
      },
    });
    return;
  }
  next();
}

/**
 * Role-Based Access Control middleware.
 * ADMIN role always bypasses role restrictions.
 */
export function requireRole(...allowedRoles: OperatorRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    if (req.user.role === "ADMIN" || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `Action requires one of the following roles: [${allowedRoles.join(", ")}]. Your role is ${req.user.role}.`,
      },
    });
  };
}

/**
 * Station-scoped authorization.
 * If user has a restricted stationId, they cannot perform actions on other stations.
 * ADMINs and cross-station operators (stationId === undefined) can access all stations.
 */
export function requireStationAccess(stationIdExtractor?: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    // Admins and unconstrained operators have cross-station privileges
    if (req.user.role === "ADMIN" || !req.user.stationId) {
      next();
      return;
    }

    const targetStationId = stationIdExtractor
      ? stationIdExtractor(req)
      : req.params.stationId || (req.body && req.body.stationId);

    if (!targetStationId || targetStationId === req.user.stationId) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `Operator ${req.user.username} is scoped strictly to ${req.user.stationId} and cannot access ${targetStationId}.`,
      },
    });
  };
}
