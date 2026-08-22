import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type StaffRole = "admin" | "staff";

export type CurrentStaff = {
  email: string | null;
  role: StaffRole;
  userId: string;
};

export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staffUser, error } = await supabase
    .from("staff_users")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !staffUser?.active || (staffUser.role !== "admin" && staffUser.role !== "staff")) return null;

  return { email: user.email ?? null, role: staffUser.role, userId: user.id };
}

export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login?error=unauthorized");
  return staff;
}
