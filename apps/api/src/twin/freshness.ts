import type { FreshnessInfo, FreshnessStatus } from "@maitri-bharati/shared";

export function computeFreshness(observedAtDate?: Date | string | null, now = new Date()): FreshnessInfo {
  if (!observedAtDate) {
    return {
      observedAt: new Date(0).toISOString(),
      ageSeconds: 999999,
      status: "UNKNOWN",
    };
  }

  const observed = typeof observedAtDate === "string" ? new Date(observedAtDate) : observedAtDate;
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 1000));

  let status: FreshnessStatus;
  if (ageSeconds <= 30) {
    status = "FRESH";
  } else if (ageSeconds <= 300) {
    status = "STALE";
  } else {
    status = "UNKNOWN";
  }

  return {
    observedAt: observed.toISOString(),
    ageSeconds,
    status,
  };
}
