import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

const app = createApp();

describe("Health endpoints", () => {
  it("GET /health returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("0.1.0");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /ready returns status ok with checks", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.checks).toHaveProperty("api");
  });

  it("GET /api returns API info", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Maitri-Bharati Digital Twin API");
  });
});
