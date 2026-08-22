import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { logStaffPerformance } from "@/lib/staff/performance";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "staff";

export type CurrentStaff = {
  email: string | null;
  role: StaffRole;
  userId: string;
};

export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const authorisationStartedAt = performance.now();
  const supabase = await createClient();
  const identityStartedAt = performance.now();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  logStaffPerformance("staff-identity-verification", identityStartedAt, claimsError || !userId ? "unavailable" : "success");

  if (!userId) {
    logStaffPerformance("staff-authorisation", authorisationStartedAt, "unavailable");
    return null;
  }

  const staffLookupStartedAt = performance.now();
  const { data: staffUser, error } = await supabase
    .from("staff_users")
    .select("role, active")
    .eq("user_id", userId)
    .maybeSingle();

  const authorised = !error && staffUser?.active && (staffUser.role === "admin" || staffUser.role === "staff");
  logStaffPerformance("staff-users-authorisation", staffLookupStartedAt, authorised ? "allowed" : "not-authorised");

  if (!authorised) {
    logStaffPerformance("staff-authorisation", authorisationStartedAt, "not-authorised");
    return null;
  }

  logStaffPerformance("staff-authorisation", authorisationStartedAt, "allowed");
  return { email: typeof claims?.email === "string" ? claims.email : null, role: staffUser.role, userId };
});

export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login?error=unauthorized");
  return staff;
}
