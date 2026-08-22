"use client";

import { useActionState } from "react";

import { signInStaff, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(signInStaff, initialState);

  return <form action={formAction}>
    <label>Email address<input name="email" type="email" autoComplete="email" placeholder="name@school.edu.in" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
    <button className="button gold" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in securely"} <span>→</span></button>
    {state.message && <p className="auth-note" role="status" aria-live="polite">{state.message}</p>}
  </form>;
}
