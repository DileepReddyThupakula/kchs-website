"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { message?: string };

export async function signInStaff(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { message: "Please enter your email address and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) return { message: "We could not sign you in with those details." };

  const { data: staffUser, error: staffError } = await supabase
    .from("staff_users")
    .select("active, role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (staffError || !staffUser?.active || (staffUser.role !== "admin" && staffUser.role !== "staff")) {
    await supabase.auth.signOut();
    return { message: "This account is not authorised for the staff portal." };
  }

  redirect("/staff");
}
