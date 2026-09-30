import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { hashPassword, verifyPassword, createToken, verifyToken } from "../auth/crypto";
import type { AuthUser } from "@maitri-bharati/shared";

describe("Phase B: Authentication & RBAC Layer", () => {
  const app = createApp();

  describe("1. Password Hashing & Token Verification", () => {
    it("hashes and validates passwords using scrypt and constant-time comparison", () => {
      const password = "antigravity2026";
      const hash = hashPassword(password);

      expect(hash).toContain(":");
      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword("wrongpassword", hash)).toBe(false);
      expect(verifyPassword("", hash)).toBe(false);
    });

    it("generates and verifies signed HMAC-SHA256 session tokens", () => {
      const user: AuthUser = {
        id: "op-test-01",
        username: "officer.maitri",
        fullName: "Cmdr. Vikram Negi",
        role: "OPERATOR",
        stationId: "station-maitri",
      };

      const token = createToken(user, 3600);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.username).toBe("officer.maitri");
      expect(decoded?.role).toBe("OPERATOR");
      expect(decoded?.stationId).toBe("station-maitri");
    });

    it("rejects expired or tampered session tokens", () => {
      const user: AuthUser = {
        id: "op-test-02",
        username: "admin",
        fullName: "Col. Rajesh Sharma",
        role: "ADMIN",
      };

      // Token with 0 second lifespan
      const expiredToken = createToken(user, -10);
      expect(verifyToken(expiredToken)).toBeNull();

      // Tampered token
      const validToken = createToken(user, 3600);
      const parts = validToken.split(".");
      const tampered = `${parts[0]}.${parts[1]}tampered.${parts[2]}`;
      expect(verifyToken(tampered)).toBeNull();
    });
  });

  describe("2. Authentication REST Endpoints", () => {
    it("POST /api/auth/login succeeds for valid admin credentials and sets auth_token cookie", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin", password: "antigravity2026" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe("ADMIN");
      expect(res.body.data.token).toBeDefined();

      // Verify cookie
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes("auth_token="))).toBe(true);
    });

    it("POST /api/auth/login fails with 401 for incorrect credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin", password: "incorrect-password" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("GET /api/auth/me returns authenticated operator info with valid Bearer token", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: "officer.maitri", password: "antigravity2026" });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe("officer.maitri");
      expect(res.body.data.user.role).toBe("OPERATOR");
      expect(res.body.data.user.stationId).toBe("station-maitri");
      expect(res.body.data.permissions.canAcknowledgeAlerts).toBe(true);
    });

    it("GET /api/auth/me rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("POST /api/auth/logout clears auth session cookie", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes("auth_token=;"))).toBe(true);
    });
  });

  describe("3. Role-Based & Station-Scoped Access Control", () => {
    it("ADMIN can view all operators via GET /api/auth/operators", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin", password: "antigravity2026" });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .get("/api/auth/operators")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("Non-admin role is rejected with 403 when trying to access admin endpoints", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: "viewer", password: "antigravity2026" });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .get("/api/auth/operators")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
