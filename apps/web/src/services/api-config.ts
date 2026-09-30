/**
 * Centralized API and WebSocket URL configuration with runtime origin detection
 * and environment variable overrides.
 */

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:3001/api`;
  }
  return "http://localhost:3001/api";
}

export function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string;
  }
  if (typeof window !== "undefined" && window.location) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname || "localhost";
    return `${wsProto}//${hostname}:3001/ws`;
  }
  return "ws://localhost:3001/ws";
}

export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
