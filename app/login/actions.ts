"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { message?: string };

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(512),
});

export async function signInStaff(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) return { message: "Please enter a valid email address and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials.data);

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
