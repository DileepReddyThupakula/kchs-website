import "server-only";

type PerformanceOutcome = "allowed" | "failed" | "not-authorised" | "success" | "unavailable";
type PerformanceStage = "authorization" | "loader" | "operation" | "query-wave";

const performanceLoggingEnabled = process.env.NODE_ENV !== "production" || process.env.STAFF_PERFORMANCE_LOGGING === "true";

export function logStaffTiming(operation: string, startedAt: number, outcome: PerformanceOutcome, stage: PerformanceStage) {
  if (!performanceLoggingEnabled) return;

  try {
    console.info("Staff portal performance.", {
      durationMs: Math.round(performance.now() - startedAt),
      operation,
      outcome,
      stage,
    });
  } catch {
    // Diagnostics must never interrupt the request being measured.
  }
}

export function logStaffPerformance(operation: string, startedAt: number, outcome: PerformanceOutcome) {
  logStaffTiming(operation, startedAt, outcome, "operation");
}
