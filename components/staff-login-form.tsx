"use client";

import { useActionState, useState } from "react";

import { signInStaff, type LoginState } from "@/app/login/actions";
import styles from "./staff-login-form.module.css";

const initialState: LoginState = {};

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(signInStaff, initialState);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return <form action={formAction} className={styles.form}>
    <div className={styles.field}><label htmlFor="staff-email">Email address</label><span className={styles.control}><input id="staff-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@school.edu.in" required /></span></div>
    <div className={styles.field}><label htmlFor="staff-password">Password</label><span className={styles.control}><input id="staff-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" className={styles.passwordToggle} aria-pressed={passwordVisible} aria-controls="staff-password" onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? "Hide" : "Show"}</button></span></div>
    <button className={styles.submit} disabled={pending} type="submit"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>{pending ? "Signing in…" : "Sign in securely"}</button>
    {state.message && <p className={styles.error} role="status" aria-live="polite">{state.message}</p>}
  </form>;
}
