export type AttendanceActionState = {
  kind: "idle" | "success" | "error" | "stale" | "locked";
  message?: string;
  revision?: number;
  state?: "open" | "locked";
  sessionId?: string;
};

export const initialAttendanceActionState: AttendanceActionState = { kind: "idle" };
