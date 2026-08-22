"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type StaffActionSubmitProps = {
  children: ReactNode;
  name?: string;
  onClick?: () => void;
  onPointerDown?: () => void;
  pendingChildren: ReactNode;
  value?: string;
};

export function StaffActionSubmit({ children, name, onClick, onPointerDown, pendingChildren, value }: StaffActionSubmitProps) {
  const { pending } = useFormStatus();

  return <button className="staff-action-submit" type="submit" name={name} value={value} onClick={onClick} onPointerDown={onPointerDown} disabled={pending} aria-disabled={pending}>
    {pending && <span className="staff-button-spinner" aria-hidden="true" />}
    {pending ? pendingChildren : children}
    <span className="staff-sr-only" aria-live="polite">{pending ? "Saving, please wait." : ""}</span>
  </button>;
}
