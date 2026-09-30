import crypto from "crypto";
import type { AuthUser, OperatorRole } from "@maitri-bharati/shared";

const AUTH_SECRET = process.env.AUTH_SECRET || "antigravity_antarctic_ops_secret_key_2026";
const TOKEN_MAX_AGE_SEC = 24 * 60 * 60; // 24 hours

/**
 * Derives a secure salt:key hash using Node.js built-in scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

/**
 * Validates a plain text password against a stored salt:key hash in constant time
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a signed, URL-safe HMAC-SHA256 session token with expiration
 */
export function createToken(user: AuthUser, expiresInSeconds = TOKEN_MAX_AGE_SEC): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payloadData = {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    stationId: user.stationId,
    email: user.email,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * Validates and decodes the HMAC-SHA256 session token
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    // Verify signature with constant-time equality
    const expectedSignature = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub: string;
      username: string;
      fullName: string;
      role: OperatorRole;
      stationId?: string;
      email?: string;
      exp: number;
    };

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return null; // Expired
    }

    return {
      id: decoded.sub,
      username: decoded.username,
      fullName: decoded.fullName,
      role: decoded.role,
      stationId: decoded.stationId,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}
