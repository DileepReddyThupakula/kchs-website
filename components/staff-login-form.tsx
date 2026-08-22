"use client";

import { useActionState, useState } from "react";

import { signInStaff, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(signInStaff, initialState);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return <form action={formAction} className="staff-login-form">
    <label htmlFor="staff-email">Email address<input id="staff-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@school.edu.in" required /></label>
    <label htmlFor="staff-password">Password<span className="password-field"><input id="staff-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" className="password-toggle" aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? "Hide" : "Show"}</button></span></label>
    <button className="button gold" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in securely"} <span>→</span></button>
    {state.message && <p className="auth-note" role="status" aria-live="polite">{state.message}</p>}
  </form>;
}
