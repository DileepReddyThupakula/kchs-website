"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logStaffPerformance } from "@/lib/staff/performance";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { message?: string };

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(512),
});

export async function signInStaff(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const actionStartedAt = performance.now();
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    logStaffPerformance("login-action", actionStartedAt, "failed");
    return { message: "Please enter a valid email address and password." };
  }

  const supabase = await createClient();
  const signInStartedAt = performance.now();
  const { data, error } = await supabase.auth.signInWithPassword(credentials.data);
  logStaffPerformance("login-sign-in", signInStartedAt, error || !data.user ? "failed" : "success");

  if (error || !data.user) {
    logStaffPerformance("login-action", actionStartedAt, "failed");
    return { message: "We could not sign you in with those details." };
  }

  const authorisationStartedAt = performance.now();
  const { data: staffUser, error: staffError } = await supabase
    .from("staff_users")
    .select("active, role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const authorised = !staffError && staffUser?.active && (staffUser.role === "admin" || staffUser.role === "staff");
  logStaffPerformance("login-staff-authorisation", authorisationStartedAt, authorised ? "allowed" : "not-authorised");

  if (!authorised) {
    await supabase.auth.signOut();
    logStaffPerformance("login-action", actionStartedAt, "not-authorised");
    return { message: "This account is not authorised for the staff portal." };
  }

  logStaffPerformance("login-action", actionStartedAt, "allowed");
  redirect("/staff");
}
