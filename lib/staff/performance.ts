import "server-only";

type PerformanceOutcome = "allowed" | "failed" | "not-authorised" | "success" | "unavailable";

const performanceLoggingEnabled = process.env.NODE_ENV !== "production" || process.env.STAFF_PERFORMANCE_LOGGING === "true";

export function logStaffPerformance(operation: string, startedAt: number, outcome: PerformanceOutcome) {
  if (!performanceLoggingEnabled) return;

  console.info("Staff portal performance.", {
    durationMs: Math.round(performance.now() - startedAt),
    operation,
    outcome,
  });
}
