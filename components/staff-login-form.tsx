"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";

import { signInStaff, type LoginState } from "@/app/login/actions";
import styles from "./staff-login-form.module.css";

const initialState: LoginState = {};

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(signInStaff, initialState);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <motion.form
      action={formAction}
      className={styles.form}
      aria-busy={pending}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className={styles.field}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <label htmlFor="staff-email">Email address</label>
        <span className={styles.control}>
          <motion.input
            id="staff-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@school.edu.in"
            required
            whileHover={{ borderColor: "#d4a84b" }}
            whileFocus={{ borderColor: "#d4a84b" }}
          />
        </span>
      </motion.div>

      <motion.div
        className={styles.field}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <label htmlFor="staff-password">Password</label>
        <span className={styles.control}>
          <motion.input
            id="staff-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            whileHover={{ borderColor: "#d4a84b" }}
            whileFocus={{ borderColor: "#d4a84b" }}
          />
          <motion.button
            type="button"
            className={styles.passwordToggle}
            aria-pressed={passwordVisible}
            aria-controls="staff-password"
            onClick={() => setPasswordVisible((visible) => !visible)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {passwordVisible ? "Hide" : "Show"}
          </motion.button>
        </span>
      </motion.div>

      <motion.button
        className={styles.submit}
        aria-disabled={pending}
        disabled={pending}
        type="submit"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        whileDrag={{ scale: 0.97 }}
        transition={{ duration: 0.2 }}
      >
        {pending ? (
          <motion.div
            className={styles.spinner}
            aria-hidden="true"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            "Sign in securely"
          </>
        )}
      </motion.button>

      <motion.p
        className={styles.srOnly}
        aria-live="polite"
        initial={{ opacity: 0 }}
        animate={{ opacity: pending ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {pending ? "Signing in, please wait." : ""}
      </motion.p>

      {state.message && (
        <motion.p
          className={styles.error}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {state.message}
        </motion.p>
      )}
    </motion.form>
  );
}
